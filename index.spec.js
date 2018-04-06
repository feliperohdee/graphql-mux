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
				data: {},
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
			expect(queue.requestString).to.deep.equal([]);
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
				.then(() => {
					expect(executor).to.have.been.calledWithExactly({
						requestString: 'query { user { id name } }',
						variableValues: {}
					});
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
					.then(() => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user:String!) { user (id: $user){ id name } userShipping (id: $user){ id address { city street } }',
							variableValues: {}
						});
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
					.then(() => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user_25087692:String!) { user (id: $user_25087692){ id name } userShipping (id: $user_25087692){ id address { city street } }',
							variableValues: {
								user_25087692: 'user'
							}
						});
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
					.then(() => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user:String!) { user (id: $user){ id name } userShipping (id: $user){ id address { city street }  user (id: $user){ id name } userShipping (id: $user){ id address { city street } }',
							variableValues: {}
						});
						done();
					});
			});

			it('should replace tokens with same variableValues', done => {
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
					.then(() => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user_25087692:String!) { user (id: $user_25087692){ id name } userShipping (id: $user_25087692){ id address { city street }  user (id: $user_25087692){ id name } userShipping (id: $user_25087692){ id address { city street } }',
							variableValues: {
								user_25087692: 'user'
							}
						});
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
					.then(() => {
						expect(executor).to.have.been.calledWithExactly({
							requestString: 'query($user_25087692:String!,$user_3963035677:String!) { user (id: $user_25087692){ id name } userShipping (id: $user_25087692){ id address { city street }  user (id: $user_3963035677){ id name } userShipping (id: $user_3963035677){ id address { city street } }',
							variableValues: {
								user_25087692: 'user',
								user_3963035677: 'user1'
							}
						});
						done();
					});
			});
		});
	});
});
