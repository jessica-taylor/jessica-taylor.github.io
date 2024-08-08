

            
//Read the next POS token from input and put it on the stack.  Fail if no tokens
//are left.
function getNextToken() {
    if(this.data.pos >= this.data.tokens.length) {
        this.fail(); return;
    }
    this.pushData(this.data.tokens[this.data.pos]);
    ++this.data.pos;
}

//Fail unless there are no more tokens left.
function matchEOF() {
    if(this.data.pos != this.data.tokens.length) {
        this.fail(); return;
    }
}

//Read the next token and ensure it has a certain part of speech.  Then place
//the word on the stack.
function matchPOS(pos) {
    return doAll(getNextToken, function() {
            var tok = this.popData();
            if(!tokenHasPOS(tok, pos)) { this.fail(); return; }
            this.pushData(tok[0]);
        });
}
//Read the next token and ensure that its part of speech is one of the arguments
//to matchAnyPos().  Then place [part of speech, word] on the stack.
function matchAnyPOS() {
    var poss = arguments;
    return doAll(getNextToken, function() {
            var tok = this.popData();
            for(var i in poss) {
                if(tokenHasPOS(tok, poss[i])) {
                    this.pushData([poss[i], tok[0]]);
                    return;
                }
            }
            this.fail();
        });
}
//The first argument is the label and the rest of the arguments are the
//components.  Read each component, then place [label, component0, component1,
//...] on the stack.
function matchCompound() {
    var label = arguments[0];
    arguments[0] = function() { 
        this.pushData(label); 
    };
    return collectAll.apply(null, arguments);
}
//lazyFunction(function() { return f; }) is mostly equivalent to f, except that
//lazyFunction doesn't actually evaluate the expression "f" until the function
//is called.  This can prevent stack overflows.
function lazyFunction(f) {
    return function() { return f().apply(this, arguments); };
}
//Match 0 or more copies of the thing represented by matchItem, returning them
//as a list.  It is greedy, so it will try to match as many as possible.  The
//optional prefixLen argument specifies how many items are already on the stack
//that should be included in the list.
function matchSequence(matchItem, prefixLen) {
    if(prefixLen === undefined) prefixLen = 0;
    return lazyFunction(function() {
            //choose between matching an item and then a sequence and matching
            //nothing, collecting already matched items into a list.
            return chooseOne(doAll(matchItem, matchSequence(matchItem, prefixLen + 1)),
                             function() {
                                 var res = [];
                                 for(var i = 0; i < prefixLen; ++i) {
                                     res.push(this.popData());
                                 }
                                 res.reverse();
                                 this.pushData(res);
                             });
        });
}
//Get a more readable representation of a nested list structure.
function treeString(tree) {
    if(typeof tree === 'object' && tree !== null && tree.length !== undefined) {
        var res = '[';
        for(var i = 0; i < tree.length; ++i) {
            res += treeString(tree[i]);
            if(i != tree.length - 1) {
                res += ',';
            }
        }
        return res + ']';
    }
    return '' + tree;
}
matchPreNounModifier =
    matchAnyPOS('past participle', 'gerund', 'noun', 'adjective');

matchPostNounModifier =
    lazyFunction(function() {
            return chooseOne(matchCompound('relative subject',
                                           matchPOS('relative pronoun'),
                                           matchVerbPhrase,
                                           matchObject),
                             matchCompound('relative object',
                                           matchPOS('relative pronoun'),
                                           matchNounPhrase,
                                           matchVerbPhrase),
                             matchCompound('prepositional',
                                           matchPOS('preposition'),
                                           matchNounPhrase));
        });
                                               
                                 

var matchNounPhrase =
    chooseOne(matchAnyPOS('pronoun'),
              matchCompound("determined",
                            chooseOne(matchAnyPOS('determiner', 'possessive pronoun'),
                                      matchCompound(null)),
                            matchSequence(matchPreNounModifier),
                            //matchAnyPOS('past participle', 'gerund',
                            //            'noun', 'adjective'),
                            matchSequence(matchPostNounModifier)),
              matchCompound('thing determined',
                            matchPOS('thing determiner'),
                            matchSequence(matchPreNounModifier),
                            matchSequence(matchPostNounModifier)));

var matchVerbPhrase = matchPOS('verb');

matchObject = chooseOne(matchCompound(null),
                        matchCompound('object', matchNounPhrase));

var matchSentence =
    chooseOne(matchCompound('interjection', matchPOS('interjection'),
                            chooseOne(matchCompound(null),
                                      matchPOS('period'))),
              matchCompound('basic sentence', matchNounPhrase, 
                            matchVerbPhrase, matchObject,
                            chooseOne(matchCompound(null), 
                                      matchAnyPOS('period', 'question mark'))),
              matchCompound('question', matchVerbPhrase, matchNounPhrase,
                            matchObject, chooseOne(matchCompound(null),
                                                   matchPOS('question mark'))));

//Parse a list of tokens into a sentence, returning null to indicate failure
//or a nested list representing the sentence in case of success.
function parse(tokens) {
    var env = new SearchEnv();
    env.data.tokens = tokens;
    env.data.pos = 0;
    env.stackActions(matchSentence, matchEOF);
    if(env.run()) {
        return env.popData();
    } else {
        return null;
    }
}

//A class is represented by a [determiner, list of adjectives] or the string
//'it', which represents the thing the containing sentence is describing.
//A determiner is 'some' or 'all'.
//An adjective is a list [bool, describer].
//A describer is either a noun/adjective string or a sentence with "it".
//A sentence is a list [verb string, class, class], where the first class is
//the subject and the second is the object.
var somethingClass = ['some', []]; 

function addPreNounModifiers(mods, adjs) {
    for(var i = 0; i < mods.length; ++i) {
        var mod = mods[i];
        var base = getBaseForm(mod[1], mod[0]);
        if(mod[1] !== 'thing' && mod[1] !== 'things' &&
           mod[1] !== 'one' && mod[1] !== 'ones') {
            if(mod[0] === 'gerund') {
                adjs.push([base, 'it', somethingClass]);
            } else if(mod[0] === 'past participle') {
                adjs.push([base, somethingClass, 'it']);
            } else {
                adjs.push(base);
            }
        }
    }
}
function addPostNounModifiers(clauses, adjs) {
    function pushMulti(as) {
        for(var i = 0; i < as.length; ++i) {
            adjs.push(as[i]);
        }
    }
    function addAdj(adj) {
        if(adj[0] === 'be') {
            if(adj[1] === 'it') {
                pushMulti(adj[2][1]);
            }
            if(adj[2] === 'it') {
                pushMulti(adj[1][1]);
            }
        } else {
            adjs.push(adj);
        }
    }
    for(var i = 0; i < clauses.length; ++i) {
        var clause = clauses[i];
        if(clause[0] === 'relative subject') {
            var verb = getBaseForm(clause[2], 'verb');
            if(clause[3][0] === null) {
                addAdj([verb, 'it', somethingClass]);
            } else {
                addAdj([verb, 'it', toClass(clause[3][1], 'some')]);
            }
        } else if(clause[0] === 'relative object') {
            var subject = toClass(clause[2], 'some');
            var verb = getBaseForm(clause[3], 'verb');
            addAdj([verb, subject, 'it']);
        } else if(clause[0] === 'prepositional') {
            var prep = getBaseForm(clause[1], 'preposition');
            var obj = toClass(clause[2], 'some');
            adjs.push([prep, 'it', obj]);
        }
    }
}
    
//Convert a parsed noun phrase into a class.  Use defaultDet as the determiner
//if there is no parsed determiner.
function toClass(parsed, defaultDet) {
    var det;
    var adjs;
    if(parsed[0] === 'pronoun') {
        det = 'all';
        adjs = [getBaseForm(parsed[1], 'pronoun')];
    } else if(parsed[0] === 'determined') {
        var d = parsed[1];
        if(d[0] === null) {
            det = defaultDet;
        } else det = getBaseForm(d[1], d[0]);
        adjs = [];
        if(det !== 'some' && det !== 'all') {
            adjs.push(['of', 'it', ['all', [det]]]);
            det = 'some';
        }
        addPreNounModifiers(parsed[2], adjs);
        addPostNounModifiers(parsed[3], adjs);
    } else if(parsed[0] === 'thing determined') {
        det = getBaseForm(parsed[1], 'thing determiner');
        adjs = [];
        addPreNounModifiers(parsed[2], adjs);
        addPostNounModifiers(parsed[3], adjs);
    } else {
        throw new Error("Bad type of noun phrase: " + parsed[0]);
    }
    return [det, adjs];
}
//Convert a parsed sentence to a sentence.
function toSentence(parsed) {
    if(parsed[0] === 'interjection') {
        return ['interjection', getBaseForm(parsed[1], 'interjection')];
    } else if(parsed[0] === 'basic sentence') {
        var verb = getBaseForm(parsed[2], 'verb');
        var subject = toClass(parsed[1], 'all');
        var type = parsed[4][0] === 'question mark'? 'question' : 'declaration';
        if(parsed[3][0] === null) 
            return [type, [verb, subject, somethingClass]];
        var obj = toClass(parsed[3][1], 'some');
        return [type, [verb, subject, obj]];
    } else if(parsed[0] === 'question') {
        var verb = getBaseForm(parsed[1], 'verb');
        var subject = toClass(parsed[2], 'all');
        if(parsed[3][0] === null)
            return ['question', [verb, subject, somethingClass]];
        var obj = toClass(parsed[3][1], 'some');
        return ['question', [verb, subject, obj]];
    }
}
    
