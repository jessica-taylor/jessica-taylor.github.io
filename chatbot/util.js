
//Replaces '<' wih '&lt;', '>' with '&amp;', etc. so HTML displays nicely.
String.prototype.escapeHTML = function() {
    var div = document.createElement('div');
    var text = document.createTextNode(this);
    div.appendChild(text);
    return div.innerHTML;
};

//Split a string into tokens (either a word, a number, or a sequence of
//punctuation marks).
function splitTokens(said) {
    var res = [];
    while(true) {
        var match = /[a-zA-Z\']+|\d[\d.,\s]*|[.,:;!?][.,:;!?\s]*/.exec(said);
        if(match === null) return res;
        var token = match[0];
        res.push(token);
        said = said.substr(said.indexOf(token) + token.length);
    }
}
//Determine if a string is a word.
function isWord(tok) {
    return /^[a-zA-Z\']+$/.test(tok);
}
//Get a nice representation of a token so that tokens that represent the same
//thing map to the same canonical token.
function canonicalToken(tok) {
    //get rid of spaces, convert to lower case
    tok = tok.replace(/\s/g, '').toLowerCase();
    if(isWord(tok)) return tok;
    //all these punctuation marks end declarations so they are the same
    if('.:;!'.indexOf(tok[0]) !== -1) return '.';
    //comma and question mark stay as they are
    if(',?'.indexOf(tok[0]) !== -1) return tok[0];
    //we have a number, so get rid of commas and convert to floating point
    tok = tok.replace(/\,/g, '');
    return parseFloat(tok);
}
//Split a phrase into tokens (words/numbers/punctuation).
function tokenize(said) {
    return splitTokens(said).map(canonicalToken);
}
//This maps string of the form "word pos" to the base form of the word.
//For example, 'i' is the base form of 'i', 'me', 'my', 'myself', etc.
//'go' is the base form of 'went', 'go', 'goes', 'going', etc.
//So, wordBaseForms['goes verb'] = 'go'
var wordBaseForms = {};
//This maps words to their part of speech tokens.  A part of speech token is a 
//list where the first element is the word and the remaining elements are the 
//possible parts of speech for the word.  For example, 
//wordPOSTokens['can'] = ['can', 'noun', 'verb'].
var wordPOSTokens = {};
function defWord(word, pos, base) {
    if(base !== undefined) wordBaseForms[word + ' ' + pos] = base;
    var prev = wordPOSTokens[word];
    if(typeof prev !== 'object' || prev === null || prev.length === undefined) {
        //no pos token present, so initialize it
        wordPOSTokens[word] = [word, pos];
    } else {
        //make sure part of speech is not already present in the token
        for(var i = 0; i < prev.length; ++i) {
            if(prev[i] === pos) return;
        }
        prev.push(pos);
    }
}
//Takes a part of speech as an argument.  Then takes lists of the form
//[base, word0, word1, ...] and defines the base form of the words in the 
//given part of speech to be base.  An argument may also be a single word,
//which is taken to mean that the word is its own base form.
function defWords() {
    var pos = arguments[0];
    for(var i = 1; i < arguments.length; ++i) {
        var synonyms = arguments[i];
        if(typeof synonyms === 'string') {
            //word is its own base form
            synonyms = [synonyms, synonyms];
        }
        var base = synonyms[0];
        for(var j = 1; j < synonyms.length; ++j) {
            defWord(synonyms[j], pos, base);
        }
    }
}
defWords('pronoun',
         ['i', 'i', 'me', 'myself'],
         'you',
         ['he', 'he', 'him', 'himself'],
         ['she', 'she', 'her', 'herself'],
         ['it', 'it', 'itself'],
         ['they', 'they', 'themself', 'themselves'],
         ['we', 'we', 'us', 'ourselves'],
         ['who', 'who', 'whom'], 
         'what', 'this', 'that');
defWords('determiner',
         ['some', 'some', 'a', 'an', 'the'],
         ['all', 'all', 'every', 'each']);
defWords('thing determiner',
         ['some', 'something', 'someone', 'somebody'],
         ['all', 'everything', 'everyone', 'everybody']);
defWords('possessive pronoun',
         ['i', 'my'],
         ['you', 'your'],
         ['he', 'his'],
         ['she', 'her'],
         ['it', 'its'],
         ['they', 'their'],
         ['we', 'our']);
         
defWords('verb', ['be', 'is', 'am', 'are', 'were', 'was'],
         ['have', 'have', 'has']);
defWords('relative pronoun', ['that', 'that', 'which', 'who', 'whom']);
defWords('interjection',
         ['hi', 'hi', 'hello', 'hey', 'sup', 'yo'],
         ['bye', 'bye', 'goodbye'],
         ['yay', 'yay', 'hooray', 'yipee', 'whoo', 'woot'],
         ['yes', 'yes', 'yep', 'yeah'],
         ['no', 'no', 'nope', 'nah', 'nay'],
         ['darn', 'darn', 'drat', 'damn'],
         'reset', 'forget');

defWords('preposition',
         ['in', 'in', 'inside', 'within', 'at'],
         'outside', 
         ['over', 'over', 'above', 'on', 'upon'],
         ['under', 'under', 'beneath', 'underneath'],
         'of', 'with', 'about',
         ['after', 'after', 'beyond', 'past'], 
         'before',
         ['among', 'among', 'between'],
         ['by', 'by', 'near'],
         'for',
         ['through', 'through', 'via']);
         

var finishedWordProcessing = false;

//Given a word, its base form, and the possible parts of speech of the base form
//as a string containing n = noun, v = verb, a or s = adjective, r = adverb,
//get a list of possible parts of speech for the word.
function modifiedPOSs(word, base, poss) {
    var res = [];
    seen = '';
    for(var i = 0; i < poss.length; ++i) {
        var pos = poss[i];
        if(pos === 's') pos = 'a';
        //make sure we haven't already looked at this part of speech
        if(seen.indexOf(pos) !== -1) continue;
        seen += pos;
        switch(pos) {
        case 'n':
            //all modified nouns are still nouns
            res.push('noun');
            break;
        case 'v':
            //for words like 'going'
            //the check for word != base is for things like 'fling'
            if(word.substr(-3) === 'ing' && word != base) {
                res.push('gerund');
            } else if((word.substr(-2) === 'ed' ||
                       word.substr(-2) === 'en' ||
                       word.substr(-2) === 'nt' ||
                       word.substr(-3) === 'own') && word != base) {
                //past participle/past tense verb, such as "watched" or "burnt"
                res.push('past participle');
                res.push('verb');
            } else {
                //for other forms such as 'goes' or just 'go'
                res.push('verb');
            }
            break;
        case 'a':
        case 's':
            //modified adjectives are adjectives
            res.push('adjective');
        break;
        case 'r':
            //modified adverbs are adverbs
            res.push('adverb');
            break;
        default:
            //throw new Error("Bad part of speech letter: " + pos);
        }
    }
    return res;
}
            
//Take the text of the word data as an argument and use them to form the
//database.
function processWordData(data) {
    var lines = data.split(';');
    for(var i = 0; i < lines.length; ++i) {
        //each line is of the form "word base poss base poss..."
        var toks = lines[i].split(' ');
        if(toks.length >= 3) {
            var word = toks[0];
            //eliminate frivolous parts of speech for important words
            if(wordPOSTokens[word] !== undefined) continue;
            for(var j = toks.length - 2; j >= 1; j -= 2) {
                var base = toks[j], poss = toks[j + 1];
                var mposs = modifiedPOSs(word, base, poss);
                for(var k = 0; k < mposs.length; ++k) {
                    defWord(word, mposs[k], base);
                }
            }
        }
    }
    finishedWordProcessing = true;
}
//wordDataString comes from worddata.js
//This is a js file so it can be included without violating the same origin
//policy.  This is only an issue for viewing the page locally.
processWordData(wordDataString);
//$.ajax({'url': 'worddata.txt', 'dataType': 'text', 'success' : processWordData});

//If the possible parts of speech of the word are unknown, guess what POS token
//would represent the word.
function guessPOSToken(word) {
    var res = [word];
    if(word.substr(-3) === 'ing') {
        res.push('gerund');
    } else if(word.substr(-2) === 'ed' || word.substr(-2) === 'en' ||
              word.substr(-2) === 'nt') {
        res.push('past participle');
        res.push('verb');
    } else {
        //assume it could be almost anything, because so little is known
        res.push('noun');
        res.push('verb');
        res.push('adjective');
        if(word.substr(-2) === 'ly') {
            res.push('adverb');
        }
    }
    return res;
}

//Get the token (list of word and parts of speech) of a word.
function getPOSToken(word) {
    //make sure we are done processing the word list
    while(!finishedWordProcessing) { }
    if(typeof word === 'number') {
        //numbers have their own parts of speech
        return [word, 'number'];
    }
    //so do punctuation marks
    if(word === '.') {
        return [word, 'period'];
    }
    if(word === ',') {
        return [word, 'comma'];
    }
    if(word === '?') {
        return [word, 'question mark'];
    }
    //otherwise look in the database
    var res = wordPOSTokens[word];
    if(res === undefined) {
        //not found, so we have to guess
        return guessPOSToken(word);
    }
    return res;
}
//Get the base form of a word given that it has a certain part of speech
function getBaseForm(word, pos) {
    while(!finishedWordProcessing) { }
    var res = wordBaseForms[word + ' ' + pos];
    if(res === undefined) return word;
    return res;
}
//Tokenize a phrase into POS tokens.
function tokenizePOS(said) {
    return tokenize(said).map(getPOSToken);
}
//Determine if a POS token has a certain part of speech.
function tokenHasPOS(token, pos) {
    for(var i = 1; i < token.length; ++i) {
        if(token[i] === pos) return true;
    }
    return false;
}
        
