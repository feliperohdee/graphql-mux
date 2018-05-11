const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const GraphQLMux = require('./');

chai.use(sinonChai);

const expect = chai.expect;

const requestString = `query($user: String!) {
	user (id: $user){
		id
		name
	}
	userShipping (id: $user){
		id
		address {
			city
			street
		}
	}
}`;

describe('index.js', () => {
    let queue;
    let executor;

    beforeEach(() => {
        sinon.spy(GraphQLMux.prototype, 'setup');

        executor = sinon.stub()
            .returns(Promise.resolve({
                data: {
					user: {
						id: 'id',
						name: 'name'
					},
					userOne: {
						id: 'id',
						name: 'name'
					},
					userTwo: {
						id: 'id',
						name: 'name'
					},
					userThree: {
						id: 'id',
						name: 'name'
					},
					userShipping: {
						id: 'id',
						address: {
							city: 'city',
							street: 'street'
						}
					}
				},
                errors: null
            }));

        queue = new GraphQLMux(executor, 'query', 10);
    });

    afterEach(() => {
        GraphQLMux.prototype.setup.restore();
    });

    describe('constructor', () => {
        it('should throw if executor not provided', () => {
            expect(() => new GraphQLMux()).to.throw('executor should be a function.');
        });

        it('should call setup', () => {
            expect(GraphQLMux.prototype.setup).to.have.been.called;
        });

        it('should set executor', () => {
            expect(queue.executor).to.equal(executor);
        });

        it('should set default type', () => {
            expect(queue.type).to.equal('query');
        });

        it('should set custom type', () => {
            queue = new GraphQLMux(executor, 'mutation', 10);
            expect(queue.type).to.equal('mutation');
        });

        it('should set default wait', () => {
            expect(queue.wait).to.equal(10);
        });

        it('should set custom wait', () => {
            queue = new GraphQLMux(executor, 'mutation', 15);
            expect(queue.wait).to.equal(15);
        });
    });

    describe('setup', () => {
        it('should reset', () => {
            queue.resolvers = null;
            queue.rejecters = null;
            queue.definitions = null;
            queue.requestString = null;
            queue.variableValues = null;

            queue.setup();

            expect(queue.resolvers).to.deep.equal([]);
            expect(queue.rejecters).to.deep.equal([]);
            expect(queue.definitions).to.deep.equal({});
            expect(queue.requestString).to.deep.equal({});
            expect(queue.variableValues).to.deep.equal({});
        });
    });

    describe('graphql', () => {
        it('should build query without definitions', done => {
            queue.graphql({
                    requestString: `{
						user {
							id
							name
						}
					}`
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        requestString: 'query {user_1827029371:user{ id name }}',
                        variableValues: {}
					});
					
					expect(response.data).to.have.all.keys([
						'user'
					]);

                    done();
                });
        });

        describe('single query', () => {
            it('should not replace tokens when no variables provided', done => {
                queue.graphql({
                        requestString,
                        variableValues: {
                            user: undefined
                        }
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            requestString: 'query($user:String!) {user_2067854358:user(id: $user){ id name } userShipping_2067854358:userShipping(id: $user){ id address { city street }}',
                            variableValues: {}
						});
						
						expect(response.data).to.have.all.keys([
							'user',
							'userShipping'
						]);

                        done();
                    });
            });

            it('should replace tokens', done => {
                queue.graphql({
                        requestString,
                        variableValues: {
                            user: 'user'
                        }
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            requestString: 'query($user_25087692:String!) {user_25087692:user(id: $user_25087692){ id name } userShipping_25087692:userShipping(id: $user_25087692){ id address { city street }}',
                            variableValues: {
                                user_25087692: 'user'
                            }
						});
						
						expect(response.data).to.have.all.keys([
							'user',
							'userShipping'
						]);

                        done();
                    });
			});
			
			it('should support query with alias', done => {
				queue.graphql({
						requestString: `query($user: String! $user2: String!) {
						 	user(id: $user) {
								id
								name
							},
							userOne:user(id: $user) {
								id
								name
							},
							userTwo:user(id: $user2) {
								id
								name
							}
							userThree: user (id: $user2) {
								id
								name
							}
						}`,
						variableValues: {
							user: 'user',
							user2: 'user2'
						}
					})
					.then(response => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user_3798055735:String!,$user2_3798055735:String!) {user_3798055735:user(id: $user_3798055735) { id name } userOne:user(id: $user_3798055735) { id name } userTwo:user(id: $user_37980557352) { id name } userThree:user(id: $user_37980557352) { id name }}',
							variableValues: {
								user_3798055735: 'user',
								user2_3798055735: 'user2'
							}
						});
						
						expect(response.data).to.have.all.keys([
							'user',
							'userOne',
							'userTwo',
							'userThree'
						]);
	
						done();
					});
			});
        });

        describe('multiple queries', () => {
            it('should not replace tokens when no variables provided', done => {
                Promise.all([
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: undefined
                            }
                        }),
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: undefined
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            requestString: 'query($user:String!) {user_2067854358:user(id: $user){ id name } userShipping_2067854358:userShipping(id: $user){ id address { city street }}',
                            variableValues: {}
						});
						
						expect(response[0].data).to.have.all.keys([
							'user',
							'userShipping'
						]);
						
						expect(response[1].data).to.have.all.keys([
							'user',
							'userShipping'
						]);

                        done();
                    });
            });

            it('should replace tokens with same variables', done => {
                Promise.all([
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: 'user'
                            }
                        }),
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: 'user'
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            requestString: 'query($user_25087692:String!) {user_25087692:user(id: $user_25087692){ id name } userShipping_25087692:userShipping(id: $user_25087692){ id address { city street }}',
                            variableValues: {
                                user_25087692: 'user'
                            }
						});
						
						expect(response[0].data).to.have.all.keys([
							'user',
							'userShipping'
						]);
						
						expect(response[1].data).to.have.all.keys([
							'user',
							'userShipping'
						]);

                        done();
                    });
            });

            it('should replace tokens with different variableValues', done => {
                Promise.all([
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: 'user'
                            }
                        }),
                        queue.graphql({
                            requestString,
                            variableValues: {
                                user: 'user1'
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            requestString: 'query($user_25087692:String!,$user_3963035677:String!) {user_25087692:user(id: $user_25087692){ id name } userShipping_25087692:userShipping(id: $user_25087692){ id address { city street }user_3963035677:user(id: $user_3963035677){ id name } userShipping_3963035677:userShipping(id: $user_3963035677){ id address { city street }}',
                            variableValues: {
                                user_25087692: 'user',
                                user_3963035677: 'user1'
                            }
						});
						
						expect(response[0].data).to.have.all.keys([
							'user',
							'userShipping'
						]);
						
						expect(response[1].data).to.have.all.keys([
							'user',
							'userShipping'
						]);

                        done();
                    });
            });
        });
    });
});