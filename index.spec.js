const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const GraphQLMux = require('./');

chai.use(sinonChai);

const expect = chai.expect;

const source = `query($user: String!) {
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
            queue.source = null;
            queue.variableValues = null;

            queue.setup();

            expect(queue.resolvers).to.deep.equal([]);
            expect(queue.rejecters).to.deep.equal([]);
            expect(queue.definitions).to.deep.equal({});
            expect(queue.source).to.deep.equal({});
            expect(queue.variableValues).to.deep.equal({});
        });
    });

    describe('graphql', () => {
        it('should build query without definitions', done => {
            queue.graphql({
                    source: `{
						user {
							id
							name
						}
					}`
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {user_1827029371:user{ id name }}',
                        variableValues: {}
                    });

                    expect(response.data).to.have.all.keys([
                        'user'
                    ]);

                    done();
                });
        });

        it('should build query without fields', done => {
            queue.graphql({
                    source: `{
						user (id: $user)
					}`,
                    variableValues: {
                        user: 'user'
                    }
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {user_2907055684:user(id: $_user_2907055684)}',
                        variableValues: {
                            _user_2907055684: 'user'
                        }
                    });

                    expect(response.data).to.have.all.keys([
                        'user'
                    ]);

                    done();
                });
        });

        it('should build query with custom alias', done => {
            queue.graphql({
                    source: `{
						userOne: user (id: $user)
					}`,
                    variableValues: {
                        user: 'user'
                    }
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {userOne:user(id: $_user_4219907659)}',
                        variableValues: {
                            _user_4219907659: 'user'
                        }
                    });

                    expect(response.data).to.have.all.keys([
                        'userOne'
                    ]);

                    done();
                });
        });

        it('should build invalid query', done => {
            queue.graphql({
                    source: `{
						user (id: $user) {
                            name
					}`,
                    variableValues: {
                        user: 'user'
                    }
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {user_3206577074:user(id: $_user_3206577074)}',
                        variableValues: {
                            _user_3206577074: 'user'
                        }
                    });

                    done();
                });
        });
        
        it('should not not include definition if variable not declared at query', done => {
            queue.graphql({
                    source: `query($user: String!){
						user {
                            name
                        }
					}`,
                    variableValues: {
                        user: 'user'
                    }
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {user_2585484886:user{ name }}',
                        variableValues: {
                            _user_2585484886: 'user'
                        }
                    });

                    done();
                });
        });
        
        it('should handle inner variable declarations', done => {
            queue.graphql({
                    source: `{
						user {
                            name(full: true)
                        }
					}`,
                    variableValues: {}
                })
                .then(response => {
                    expect(executor).to.have.been.calledWithExactly({
                        source: 'query {user_633591138:user{ name(full: true) }}',
                        variableValues: {}
                    });

                    done();
                });
        });

        describe('single query', () => {
            it('should build query without fields and definitions', done => {
                queue.graphql({
                        source: `{
                            user
                        }`
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query {user_644478388:user}',
                            variableValues: {}
                        });

                        expect(response.data).to.have.all.keys([
                            'user'
                        ]);

                        done();
                    });
            });

            it('should not replace tokens when no variables provided', done => {
                queue.graphql({
                        source,
                        variableValues: {}
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($user:String!) {user_2067854358:user(id: $user){ id name } userShipping_2067854358:userShipping(id: $user){ id address { city street } }}',
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
                        source,
                        variableValues: {
                            user: 'user'
                        }
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($_user_25087692:String!) {user_25087692:user(id: $_user_25087692){ id name } userShipping_25087692:userShipping(id: $_user_25087692){ id address { city street } }}',
                            variableValues: {
                                _user_25087692: 'user'
                            }
                        });

                        expect(response.data).to.have.all.keys([
                            'user',
                            'userShipping'
                        ]);

                        done();
                    });
            });
            
            it('should replace tokens with similar variables', done => {
                queue.graphql({
                        source: `query($user: String!, $userAA: String!) {
                            user (id: $user, userAA: $userAA){
                                id
                                name
                            }
                        }`,
                        variableValues: {
                            user: 'user',
                            userAA: 'userAA',
                        }
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($_user_2597501096:String!,$_userAA_2597501096:String!) {user_2597501096:user(id: $_user_2597501096, userAA: $_userAA_2597501096){ id name }}',
                            variableValues: {
                                _user_2597501096: 'user',
                                _userAA_2597501096: 'userAA'
                            }
                        });

                        done();
                    });
            });

            it('should support query with alias', done => {
                queue.graphql({
                        source: `query($user: String! $user2: String!) {
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
                            source: 'query($_user_3798055735:String!,$_user2_3798055735:String!) {user_3798055735:user(id: $_user_3798055735){ id name } userOne:user(id: $_user_3798055735){ id name } userTwo:user(id: $_user2_3798055735){ id name } userThree:user(id: $_user2_3798055735){ id name }}',
                            variableValues: {
                                _user_3798055735: 'user',
                                _user2_3798055735: 'user2'
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

            it('should support complex queries', done => {
                queue.graphql({
                        source: `query ($namespace: String) {
                            layout(namespace: $namespace) {
                                description
                                display {
                                    type
                                    props
                                }
                                enabled
                                frame {
                                    type
                                    props
                                }
                                id
                                type
                                value {
                                    ... on LayoutShowcaseWithDefaults {
                                        categories {
                                            operator
                                            value
                                        }
                                        featured
                                        ingredients {
                                            operator
                                            value
                                        }
                                        orderBy
                                        limit
                                        price
                                        recent
                                        special
                                        showcaseItems: items(enabledOnly: true, namespace: $namespace) {
                                            data {
                                                id
                                            }
                                            stats {
                                                count
                                            }
                                        }
                                    }
                                    ... on LayoutVisualWithDefaults {
                                        visualItems: items
                                    }
                                }
                                weekdays
                            }
                        }`,
                        variableValues: {}
                    })
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($namespace:String) {layout_3248356992:layout(namespace: $namespace){ description display { type props } enabled frame { type props } id type value { ... on LayoutShowcaseWithDefaults { categories { operator value } featured ingredients { operator value } orderBy limit price recent special showcaseItems: items(enabledOnly: true, namespace: $namespace) { data { id } stats { count } } } ... on LayoutVisualWithDefaults { visualItems: items } } weekdays }}',
                            variableValues: {}
                        });

                        done();
                    });
            });
        });

        describe('multiple queries', () => {
            it('should build query without fields and definitions', done => {
                Promise.all([
                        queue.graphql({
                            source: `{
                                user
                            }`
                        }),
                        queue.graphql({
                            source: `{
                                user2
                            }`
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query {user2_2620643398:user2 user_2883919540:user}',
                            variableValues: {}
                        });

                        expect(response[0].data).to.have.all.keys([
                            'user'
                        ]);

                        done();
                    });
            });

            it('should not replace tokens when no variables provided', done => {
                Promise.all([
                        queue.graphql({
                            source,
                            variableValues: {
                                user: undefined
                            }
                        }),
                        queue.graphql({
                            source,
                            variableValues: {
                                user: undefined
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($user:String!) {user_2067854358:user(id: $user){ id name } userShipping_2067854358:userShipping(id: $user){ id address { city street } }}',
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
                            source,
                            variableValues: {
                                user: 'user'
                            }
                        }),
                        queue.graphql({
                            source,
                            variableValues: {
                                user: 'user'
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($_user_25087692:String!) {user_25087692:user(id: $_user_25087692){ id name } userShipping_25087692:userShipping(id: $_user_25087692){ id address { city street } }}',
                            variableValues: {
                                _user_25087692: 'user'
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
                            source,
                            variableValues: {
                                user: 'user'
                            }
                        }),
                        queue.graphql({
                            source,
                            variableValues: {
                                user: 'user1'
                            }
                        })
                    ])
                    .then(response => {
                        expect(executor).to.have.been.calledWithExactly({
                            source: 'query($_user_25087692:String!,$_user_3963035677:String!) {user_25087692:user(id: $_user_25087692){ id name } userShipping_25087692:userShipping(id: $_user_25087692){ id address { city street } } user_3963035677:user(id: $_user_3963035677){ id name } userShipping_3963035677:userShipping(id: $_user_3963035677){ id address { city street } }}',
                            variableValues: {
                                _user_25087692: 'user',
                                _user_3963035677: 'user1'
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

        describe('error', () => {
            beforeEach(() => {
                executor = () => Promise.reject(new Error('Error'));

                queue = new GraphQLMux(executor, 'query', 10);
            });

            it('should reject', done => {
                queue.graphql({
                        source,
                        variableValues: {
                            user: 'user'
                        }
                    })
                    .catch(err => {
                        expect(err.message).to.equal('Error');
                        done();
                    })
            });
        });
    });
});