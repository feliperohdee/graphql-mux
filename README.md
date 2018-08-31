[![CircleCI](https://circleci.com/gh/feliperohdee/smallorange-graphql-mux.svg?style=svg)](https://circleci.com/gh/feliperohdee/smallorange-graphql-mux)

## Usage

		const http = json => fetch('http://yourGraphQLEndpoint.com', {
			method: 'POST',
			cache: 'no-store',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify(json)
		});
		
		const queue = new GraphQLMux(http, 'query', 10);
		
		queue.graphql({
			source: `query($user: String!) {
				user(id: $user) {
					name
				}
			}`,
			variableValues: {
				user: 'user'
			}
		})
		.then(...);
		
		queue.graphql({
			source: `query(order: String!) {
				order(id: $order) {
					date
					total
				}
			}`,
			variableValues: {
				order: 'order'
			}
		})
		.then(...);
