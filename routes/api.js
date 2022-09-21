'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 8

//takes an array of replies and returns only the n number of desired replies (set to 0 for unlimited)//
const replyFilter = (replies, outputNumber) => {
  let output = []
  let commentLimit = outputNumber
  //if there are no replies, just return []//
  if(replies.length === 0){ return replies }
  replies.sort((a, b) => {
    //sort is a bit awkward like this but if we return -1 vs 1 it sorts based on this.
    if(a.created_on > b.created_on){ return -1 }
  })
  //push the requested amount of replies to the output array, removing the password fields//
  let currentNumber = 0
  replies.forEach((reply) => {
    //if unlimited (set to 0) or we have not reached supplied limit yet//
    if(commentLimit === 0 || currentNumber < commentLimit){
      //push to output only the fields client is allowed to receive//
      output.push({
        _id: reply._id,
        text: reply.text,
        created_on: reply.created_on
      })
      currentNumber++;
    }
  })
  // console.log(output)
  return output
}


module.exports = function (app) {

  //mongoose setup
  mongoose.connect(process.env.MONGO_URI, {useNewUrlparser: true, useUnifiedTopology: true });
  let messageSchema = new mongoose.Schema({
    board: {type: String, required: true},
    text: {type: String, required: true},
    delete_password: {type: String, required: true},
    created_on: Date,
    bumped_on: Date,
    reported: Boolean,
    replies: [Object]
  })
  let Message = mongoose.model('Message', messageSchema);

  
  app.route('/api/threads/:board')
     //handle posting a new thread TODO encrypt/compare all delete passwords (on all methods)
     .post((req, res) => {
      // console.log(req.body)
      Message.create({
        board: req.params.board || req.body.board,
        text: req.body.text,
        delete_password: req.body.delete_password,
        created_on: new Date(),
        bumped_on: new Date(),
        reported: false,
        replies: []
      }, (err, message) => {
        if(err){
          // console.log(err)
          return res.json({error: err})
        }else{
          // console.log(message)
          return res.json({message})
        }
      })
     })

     //handle getting a specific board TODO limit to 3 most recent replies
     .get((req, res) => {
      let reqBoard = req.params.board
      let output = []
      //Using mongoose we can make a find() query using the sort (on date) and limit (to ten) options
      Message.find({board: reqBoard}) 
             .sort({bumped_on: -1})
             .limit(10)
             .exec((err, board) => {
              //create output array with data the user is allowed to see
              board.forEach((entry) => {
                output.push({
                  _id: entry._id,
                  board: entry.board,
                  text: entry.text,
                  created_on: entry.created_on,
                  bumped_on: entry.bumped_on,
                  replies: replyFilter(entry.replies, 3),
                  //add the replycount to output object and set total number of replies//
                  replycount: entry.replies.length
                  //if replies has more than 3 entries -> keep only the three newest ones//
                })
              })
              //return our output//
              // console.log(output)
              return res.json(output)
            })
     })

     //delete a whole thread
     .delete((req, res) => {
      //extract board, thread_id and password//
      const {board, thread_id, delete_password} = req.body
      //get the item with thread id from database//
      Message.find({_id: thread_id}, (err, item) => {
        //if no message was found return no message found//
        // console.log(item)
        if(item.length === 0){
          return res.send('no such thread exists')
        }
        //check if the password matches//
        if(item[0].delete_password !== delete_password){
          //if password is wrong return incorrect password//
          return res.send('incorrect password');
        }else{
          //if password is correct delete the whole thread from database//
          Message.deleteOne({_id: thread_id}, (err, deletedDoc) => {
            if(!err && deletedDoc){
              return res.send('success')
            }
          })
        }
      })
     })

     //report a thread
     .put((req, res) => {
      // console.log(req.body)
      //first find the message we want to flag as reported//
      Message.findOneAndUpdate(
        //search criteria//
        {_id: req.body.thread_id},
        //updates to apply//
        {reported: true},
        //return new obj//
        {new: true},
        (err, message) => {
          if(err){
            // console.log(err)
            return res.send('Error: please double check thread-id')
          }else{
            return res.send('reported')
          }
        }
      )
     })


    
  app.route('/api/replies/:board')
    //handle posting a new reply
    .post((req, res) => {
    // console.log(req.body)
    let updates = {
      bumped_on: new Date(),
      $push: {replies: {
        _id: new mongoose.Types.ObjectId(),
        text: req.body.text,
        created_on: new Date(),
        delete_password: req.body.delete_password,
        reported: false
      }}
    }
    Message.findOneAndUpdate(
      //search criteria//
      {_id: req.body.thread_id},
      //updates to apply//
      updates,
      //return new obj//
      {new: true},
      (err, message) => {
        if(err){
          console.log(err);
        }else{
          console.log(process.cwd());
          //redirect to the page for this specific thread//
          res.redirect(`/b/${req.params.board}/${req.body.thread_id}`);
        }
      }
    )
    })

    //handle getting a specific thread
    .get((req, res) => {
      let reqBoard = req.params.board
      let thread_id = req.query.thread_id
      //Using mongoose we can make a find() query using the sort (on date) and limit (to ten) options
      Message.find({board: reqBoard, _id: thread_id}) 
              .exec((err, board) => {
              //create output array with data the user is allowed to see
              let output = []
              output.push({
                _id: board[0]._id,
                board: board[0].board,
                text: board[0].text,
                created_on: board[0].created_on,
                bumped_on: board[0].bumped_on,
                replies: replyFilter(board[0].replies, 0)
              })
              //make sure we send the object without the container array//
              return res.json(output[0])
            })
      })

    //delete individual comments
    .delete((req, res) => {
      //get the board, thread_id, comment_id and password//
      const {board, thread_id, reply_id, delete_password} = req.body
      // console.log(req.body)
      //get the item with this thread id from database//
      Message.find({_id: thread_id}, (err, item) => {
        //if no thread was found return with a message//
        if(item === undefined || item.length === 0){
          return res.send('no such thread exists')
        }
        //check if there is a match at all for the supplied comment id//
        let no_of_matches = 0
        let pwMatch = false
        item[0].replies.forEach(reply => {
          //use .valueOf() to convert mongoDB ObjectId to string so you can compare
          if(reply._id.valueOf() === reply_id){
            no_of_matches++;
            reply.delete_password === delete_password ? pwMatch = true : pwMatch = false;
          }
        })
        //if no such comment was found, return with a message//
        if(no_of_matches === 0){
          return res.send('no such comment exists')
        }
        //check if password matches//
        if(!pwMatch){
          //if password is wrong, return with a message//
          return res.send('incorrect password')
        }else{
          //if password is correct do not delete comment but only set text to [deleted]//
          //we search for the message where our replies._id equals the id.//
          Message.updateOne({'replies._id': mongoose.Types.ObjectId(reply_id)}, {'$set': {
            //then set the text of only that one reply to [deleted]//
            'replies.$.text': '[deleted]'
          }}, (err) => {
            if(err){
              console.log(err)
            }else{
              return res.send('success')
            }
          })
        }
      })
    })

    //report individual comments
    .put((req, res) => {
      //get board, thread_id and reply_id from req.body//
      const {board, thread_id, reply_id} = req.body
      //find the thread by id//
      Message.find({_id: thread_id}, (err, item) => {
        //if no thread was found return with a message//
        if(item === undefined || item.length === 0){
          return res.send('no such thread exists')
        }
        //check if the supplied reply_id actually exists//
        let no_of_matches = 0
        item[0].replies.forEach(reply => {
          if(reply._id.valueOf() === reply_id){
            no_of_matches++;
          }
        })
        //if no such comment was found, return with a message//
        if(no_of_matches === 0){
          return res.send('no such comment exists')
        }else{
          //flag the reply as reported//
          Message.updateOne({'replies._id': mongoose.Types.ObjectId(reply_id)}, {'$set': {
            'replies.$.reported': true
          }}, (err, item) => {
            if(err){
              console.log(err)
            }else if(!err && item){
              return res.send('reported')
            }
          })
        }
      })
    })
    
};
