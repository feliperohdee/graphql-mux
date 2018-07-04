const assign = require('lodash/assign');
const indexOf = require('lodash/indexOf');
const isFunction = require('lodash/isFunction');
const isUndefined = require('lodash/isUndefined');
const map = require('lodash/map');
const reduce = require('lodash/reduce');
const trim = require('lodash/trim');
const values = require('lodash/values');

const matchBracket = require('./matcher');

const matchDefinitions = /\$\w+:\s*[^$,)]*/g;
const matchBracketsContent = /\{.*\}/g;
const matchFirstParenthesysContent = /\(.*?\)/g;
const replaceSimplifyString = /\s{2,}|\n|\r/g;
const replaceAfterParenthesysOrBracket = /[{(].*/g;
const replaceAfterBracket = /\{.*/g;

const hash = str => {
    let hash = 5381,
        i = str.length;

    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }

    return hash >>> 0;
};

const outerBrackets = (value, from = 0) => {
    let result = [];
    let start = indexOf(value, '{', from);

    if (start >= 0) {
        const end = matchBracket(value, start);

        if (!end) {
            return null;
        }
        
        result = result.concat({
            start,
            end
        });

        const next = outerBrackets(value, end);

        if (next) {
            result = result.concat(next);
        }

        return result;
    }

    return null;
};

const match = (value, regex, index = 0) => {
    const result = value.match(regex);

    if (index === 'ALL') {
        return result;
    }

    return (result && result[index]) || null;
};

const replace = (value, regex, replacer = '') => {
    return value.replace(regex, replacer);
};

module.exports = class GraphQLMux {
    constructor(executor, type = 'query', wait = 10) {
        if (!isFunction(executor)) {
            throw new Error('executor should be a function.');
        }

        this.setup();

        this.executor = executor;
        this.type = type;
        this.wait = wait;
    }

    id(requestString, variableValues = {}) {
        return hash(requestString + JSON.stringify(variableValues));
    }

    setup() {
        this.resolvers = [];
        this.rejecters = [];
        this.definitions = {};
        this.requestString = {};
        this.variableValues = {};
    }

    graphql({
        requestString = '',
        variableValues = {}
    }) {
        clearTimeout(this.timeout);

        const id = this.id(requestString, variableValues);
        const definitions = reduce(match(requestString, matchDefinitions, 'ALL'), (reduction, token) => {
            const [
                key,
                value
            ] = token.split(':');

            return assign({}, reduction, {
                [trim(key)]: trim(value)
            });
        }, {});

        requestString = replace(requestString, replaceSimplifyString, ' ');
        requestString = match(requestString, matchBracketsContent);
        requestString = trim(requestString, ['{', '}']);
        variableValues = map(variableValues, (value, key) => ({
                key,
                value
            }))
            .sort((a, b) => a.key.length < b.key.length);

        this.variableValues = reduce(variableValues, (reduction, {
            value, 
            key
        }, index) => {
            if (!isUndefined(value)) {
                reduction[`_${key}_${id}`] = value;

                requestString = replace(requestString, new RegExp(`\\$${key}`, 'g'), `$_${key}_${id}`);
            }

            return reduction;
        }, this.variableValues);

        this.definitions = reduce(definitions, (reduction, value, key) => {
            key = key.slice(1);           
            const hasVariable = !isUndefined(this.variableValues[`_${key}_${id}`]);
            const existsOnQuery = requestString.indexOf(hasVariable ? `$_${key}_${id}` : `$${key}`) >= 0;

            if(existsOnQuery) {
                reduction[hasVariable ? `$_${key}_${id}` : `$${key}`] = value;
            }

            return reduction;
        }, this.definitions);

        const brackets = outerBrackets(requestString);
        const fields = reduce(brackets || [{
            start: 0,
            end: 0
        }], (reduction, {
            start,
            end
        }, index, source) => {
            const prev = source[index - 1] || {
                end: 0
            };
            
            const query = trim(end ? requestString.slice(prev.end, end) : requestString);
            const field = trim(replace(query, replaceAfterParenthesysOrBracket), [',', ' ']);
            const firstParenthesys = match(query.replace(replaceAfterBracket, ''), matchFirstParenthesysContent);
            const splitted = field.split(':').map(trim);
            const nativeAlias = splitted.length > 1;

            return reduction.concat({
                primary: {
                    nativeAlias,
                    alias: nativeAlias ? splitted[0] : `${splitted[0]}_${id}`,
                    value: splitted[nativeAlias ? 1 : 0]
                },
                rest: {
                    value: `${firstParenthesys || ''}${requestString.slice(start, end)}`
                }
            });
        }, []);

        this.requestString[id] = reduce(fields, (reduction, {
                primary,
                rest
            }) => {
                return reduction.concat(`${primary.alias}:${primary.value}${rest.value}`);
            }, [])
            .join(' ');

        this.timeout = setTimeout(() => {
            const resolvers = [].concat(this.resolvers);
            const rejecters = [].concat(this.rejecters);
            const definitions = reduce(this.definitions, (reduction, value, key) => {
                    return reduction.concat(`${key}:${value}`);
                }, [])
                .join();

            this.executor({
                    requestString: `${this.type}${definitions ? `(${definitions})` : ''} {${values(this.requestString).join(' ')}}`,
                    variableValues: this.variableValues
                })
                .then(response => {
                    while (resolvers.length > 0) {
                        resolvers.shift()(response);
                    }
                })
                .catch(err => {
                    while (rejecters.length > 0) {
                        rejecters.shift()(err);
                    }
                });

            this.setup();
        }, this.wait);

        return new Promise((resolve, reject) => {
            this.resolvers.push(response => {
                resolve(assign({}, response, {
                    data: response.data && reduce(fields, (reduction, {
                        primary
                    }) => {
                        const fieldResponse = response.data[primary.alias] || response.data[primary.value];
    
                        reduction[primary.nativeAlias ? primary.alias : primary.value] = fieldResponse;
    
                        return reduction;
                    }, {})
                }));
            });
            this.rejecters.push(reject);
        });
    }
};