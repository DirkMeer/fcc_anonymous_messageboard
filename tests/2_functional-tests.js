const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
    let thread_id
    let reply_id

    test('Creating a new thread: POST request to /api/threads/{board}', function(done) {
        chai.request(server)
            .post('/api/threads/test')
            .send({
                board: 'test',
                text: 'Just testing lalalalalalalalalalalalalalalalal',
                delete_password: 'test'
            })
            .end(function(err, res) {
                let msg = res.body.message
                thread_id = msg._id
                console.log(thread_id)
                assert.equal(res.status, 200)
                assert.equal(msg.board, 'test')
                assert.equal(msg.text, 'Just testing lalalalalalalalalalalalalalalalal')
                assert.equal(msg.delete_password, 'test')
                assert.equal(msg.reported, false)
                assert.isArray(msg.replies)
                assert.instanceOf(new Date(msg.created_on), Date)
                assert.instanceOf(new Date(msg.bumped_on), Date)
                done()
            })
    })

    test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function(done) {
        chai.request(server)
            .get('/api/threads/general')
            .end(function(err, res) {
                assert.equal(res.status, 200)
                //max 10 threads test
                assert.isAtMost(res.body.length, 10)
                //test each thread for max 3 replies shown
                res.body.forEach((thread) => {
                    assert.isAtMost(thread.replies.length, 3)
                })
                done()
            })
    })

    test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', function(done) {
        chai.request(server)
            .delete('/api/threads/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                delete_password: 'invalid_password'
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'incorrect password')
                done()
            })
    })

    test('Reporting a thread: PUT request to /api/threads/{board}', function(done) {
        chai.request(server)
            .put('/api/threads/test')
            .send({
                board: 'test',
                thread_id: thread_id,
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'reported')
                done()
            })
    })

    test('Creating a new reply: POST request to /api/replies/{board}', function(done) {
        chai.request(server)
            .post('/api/replies/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                text: 'bladieblaa',
                delete_password: 'test'
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.type, 'text/html')
                done()
            })
    })

    test('Viewing a single thread with all replies: GET request to /api/replies/{board}', function(done) {
        chai.request(server)
            .get(`/api/replies/test?thread_id=${thread_id}`)
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.body.board, 'test')
                assert.equal(res.body.text, 'Just testing lalalalalalalalalalalalalalalalal')
                assert.equal(res.body.replies[0].text, 'bladieblaa')
                reply_id = res.body.replies[0]._id
                done()
            })
    })

    test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function(done) {
        chai.request(server)
            .delete('/api/replies/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                reply_id: reply_id,
                delete_password: 'wrong_password'
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'incorrect password')
                done()
            })
    })

    test('Reporting a reply: PUT request to /api/replies/{board}', function(done) {
        chai.request(server)
            .put('/api/replies/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                reply_id: reply_id
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'reported')
                done()
            })
    })

    test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function(done) {
        chai.request(server)
            .delete('/api/replies/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                reply_id: reply_id,
                delete_password: 'test'
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'success')
                done()
            })
    })

    test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', function(done) {
        chai.request(server)
            .delete('/api/threads/test')
            .send({
                board: 'test',
                thread_id: thread_id,
                delete_password: 'test'
            })
            .end(function(err, res) {
                assert.equal(res.status, 200)
                assert.equal(res.text, 'success')
                done()
            })
    })


});
