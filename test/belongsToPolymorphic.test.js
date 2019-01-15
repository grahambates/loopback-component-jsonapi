'use strict'

var request = require('supertest')
var loopback = require('loopback')
var expect = require('chai').expect
var JSONAPIComponent = require('../')
var app
var ds
var Post
var FileModel

describe('loopback json api belongsTo polymorphic relationships', function () {
  beforeEach(function () {
    app = loopback()
    app.set('legacyExplorer', false)
    ds = loopback.createDataSource('memory')
    Post = ds.createModel('post', {
      id: { type: Number, id: true },
      title: String,
      content: String
    })
    app.model(Post)

    FileModel = ds.createModel('fileModel', {
      id: { type: Number, id: true },
      fileName: String,
      parentId: Number,
      parentType: String
    })
    FileModel.belongsTo('parent', {
      polymorphic: {
        foreignKey: 'parentId',
        discriminator: 'parentType'
      }
    })
    app.model(FileModel)

    app.use(loopback.rest())
    JSONAPIComponent(app)
  })

  describe('File belonging to a Post', function () {
    beforeEach(function (done) {
      Post.create(
        {
          title: 'Post One',
          content: 'Content'
        },
        function (err, post) {
          expect(err).to.equal(null)
          FileModel.create(
            {
              fileName: 'blah.jpg',
              parentId: post.id,
              parentType: 'post'
            },
            done
          )
        }
      )
    })

    it('should have a relationship to Post', function (done) {
      request(app).get('/fileModels/1').end(function (err, res) {
        expect(err).to.equal(null)
        expect(res.body).to.not.have.key('errors')
        expect(res.body.data.relationships.parent).to.be.an('object')
        done()
      })
    })

    it(
      'should return the Post that this file belongs to when included flag is present',
      function (done) {
        request(app)
          .get('/fileModels/1?include=parent')
          .end(function (err, res) {
            expect(err).to.equal(null)
            expect(res.body).to.not.have.key('errors')
            expect(res.body.included).to.be.an('array')
            expect(res.body.included[0].type).to.equal('posts')
            expect(res.body.included[0].id).to.equal('1')
            done()
          })
      }
    )

    it(
      'should return the Post that this file belongs to when following the relationship link',
      function (done) {
        request(app).get('/fileModels/1').end(function (err, res) {
          expect(err).to.equal(null)
          expect(res.body).to.not.have.key('errors')
          request(app)
            .get(
              res.body.data.relationships.parent.links.related.split('api')[1]
            )
            .end(function (err, res) {
              expect(err).to.equal(null)
              expect(res.body).to.not.have.key('errors')
              expect(res.body.data.type).to.equal('posts')
              expect(res.body.data.id).to.equal('1')
              done()
            })
        })
      }
    )
  })

  describe('File with no relationship to a Post', function () {
    beforeEach(function (done) {
      FileModel.create(
        {
          fileName: 'blah.jpg'
        },
        done
      )
    })

    it('should return a null value for relationship data', function (done) {
      request(app).get('/fileModels/1').end(function (err, res) {
        expect(err).to.equal(null)
        expect(res.body).to.not.have.key('errors')
        expect(res.body.data.relationships.parent).to.be.an('object')
        expect(res.body.data.relationships.parent.data).to.equal(null)
        done()
      })
    })
  })

  describe('Create relationship via API', function () {
    beforeEach(function (done) {
      Post.create(
        {
          title: 'Post One',
          content: 'Content'
        },
        done
      )
    })

    it('should define a relationship to Post when file is created', function (
      done
    ) {
      request(app)
        .post('/fileModels')
        .send({
          data: {
            type: 'fileModels',
            attributes: {
              fileName: 'blah.jpg'
            },
            relationships: {
              parent: {
                data: {
                  id: 1,
                  type: 'posts'
                }
              }
            }
          }
        })
        .set('accept', 'application/vnd.api+json')
        .set('content-type', 'application/json')
        .expect(201)
        .end(function (err, res) {
          expect(err).to.equal(null)
          expect(res.body).to.not.have.key('errors')
          expect(res.body.data.relationships.parent).to.be.an('object')
          expect(res.body.data.relationships.parent.data).to.be.an('object')
          done()
        })
    })

    it('should ignore relationships with an invalid type', function (done) {
      request(app)
        .post('/fileModels')
        .send({
          data: {
            type: 'fileModels',
            attributes: {
              fileName: 'blah.jpg'
            },
            relationships: {
              parent: {
                data: {
                  id: 1,
                  type: 'invalidType'
                }
              }
            }
          }
        })
        .set('accept', 'application/vnd.api+json')
        .set('content-type', 'application/json')
        .expect(201)
        .end(function (err, res) {
          expect(err).to.equal(null)
          expect(res.body).to.not.have.key('errors')
          expect(res.body.data.relationships.parent).to.be.an('object')
          expect(res.body.data.relationships.parent.data).to.equal(null)
          done()
        })
    })
  })
})
