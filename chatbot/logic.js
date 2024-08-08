//A set is represented as a map from string representation of an object to the
//object itself.
function arrayToSet(arr, tostr) {
    if(tostr === undefined) tostr = function(x) { return '' + x; };
    var res = {};
    for(var i = 0; i < arr.length; ++i) {
        res[tostr(arr[i])] = arr[i];
    }
    return res;
}
function setToArray(set) {
    var res = [];
    for(var i in set) {
        res.push(set[i]);
    }
    return res;
}
//A brain represents the logical memories of a bot.
function Brain() {
    //a list of [requirements, consequences] pairs, where both are a list of
    //adjectives.  If all requirements are true for an object, so must the
    //consequences.
    this.implications = [];
    //a set of adjective lists describing things that are known to exist
    this.exists = {};
    //when to stop with the current computation
    this.stopTime = undefined;
}

Brain.prototype.setStopTimeAhead = function(ms) {
    if(ms === undefined) this.stopTime = undefined;
    else this.stopTime = new Date().getTime() + ms;
};

Brain.prototype.hasTime = function() {
    return this.stopTime === undefined || new Date().getTime() <= this.stopTime;
};

function indent(n) {
    var res = [];
    for(var i = 0; i < n; ++i) res.push('-');
    return res.join('');
}

//Determine if a list of adjectives together imply another list of adjectvies.
Brain.prototype.adjectivesImply = function(implier, implied, depth) {
    if(depth < 0) return false;
    //console.log("adjectivesImply " + treeString(implier) + " " + treeString(implied) + " " + depth);
    //the set of things that are already known
    var knownSet = arrayToSet(implier, treeString);
    //use self in inner functions because "this" refers to something else
    var self = this;
    //determine if x is implied by anything in the known set
    function isKnown(x) {
        for(var i in knownSet) {
            if(!self.hasTime()) return false;
            var known = knownSet[i];
            //if they are equal objects or strings, they must imply each other
            if(known === x) return true;
            //check for relative clauses
            if(typeof known !== 'object' || typeof x !== 'object') 
                continue;
            if(self.sentenceImplies(known, x, depth-1)) return true;
        }
        return false;
    }                   
    //determine if every sentence is implied by something in the known set
    function allKnown(sentences) {
        for(var i = 0; i < sentences.length; ++i) {
            if(!isKnown(sentences[i])) return false;
        }
        return true;
    }
    //add a sentence to the known set
    function addKnown(x) {
        knownSet[treeString(x)] = x;
    }
    while(this.hasTime()) {
        //if we already know everything we want to prove, we are done
        if(allKnown(implied)) return true;
        //was any knowledge added this round?
        var added = false;
        //test every implication
        for(var i = 0; i < this.implications.length; ++i) {
            if(!this.hasTime()) return false;
            var implication = this.implications[i];
            if(allKnown(implication[0])) {
                //if all requirements are known, add consequences to known set
                var consequences = implication[1];
                for(var j = 0; j < consequences.length; ++j) {
                    if(!this.hasTime()) return false;
                    //add each consequence if it is not known
                    if(!isKnown(consequences[j])) {
                        addKnown(consequences[j]);
                        added = true;
                    }
                }
            }
        }
        //if we didn't learn anything this round, there is no point continuing
        if(!added) return false;
    }
    return false;
};
//Determine if something satisfying a list of adjectives is known to exist.
Brain.prototype.knowsExists = function(ex, depth) {
    if(depth < 0) return false;
    //assume that something exists
    if(ex.length === 0) return true;
    //assume that singular words exist; for example, a penguin exists.
    if(ex.length === 1 && typeof ex[0] === 'string') return true;
    for(var i in this.exists) {
        if(!this.hasTime()) return false;
        var known = this.exists[i];
        //if an object is known to exist and satisfies the properties, true
        if(this.adjectivesImply(known, ex, depth)) return true;
    }
    return false;
};
//Register that something satisfying a list of adjectives is known to exist.
Brain.prototype.addExists = function(ex) {
    this.exists[treeString(ex)] = ex;
};
    
//Determine if a sentence being true for one class implies it is true for
//another class.
Brain.prototype.classImplies = function(implier, implied, depth) {
    if(depth < 0) return false;
    //it = it
    if(implier === 'it') return implied === 'it';
    if(implied === 'it') return false;
    //assume that things we are talking about must exist
    this.addExists(implier[1]);
    this.addExists(implied[1]);
    if(implier[0] == 'some') {
        //cannot prove universal statement from existential one
        if(implied[0] == 'all') return false;
        //for example: if a statement is true for a penguin,
        //it is true for a bird
        return this.adjectivesImply(implier[1], implied[1], depth);
    }
    if(implied[0] == 'all') {
        //for example: if a statement is true for all birds,
        //it is true for all penguins
        return this.adjectivesImply(implied[1], implier[1], depth);
    }
    //for example, to prove that if all birds fly then some human flies, we 
    //must prove that there exists something that is both a bird and a human.
    return this.knowsExists(implier[1].concat(implied[1]), depth);
};
//Determine if one sentence implies that another is true.
Brain.prototype.sentenceImplies = function(implier, implied, depth) {
    if(depth < 0) return false;
    //must have same verb
    if(implier[0] != implied[0]) return false;
    for(var i = 1; i < implier.length; ++i) {
        //all arguments must imply corresponding ones
        if(!this.classImplies(implier[i], implied[i], depth)) return false;
    }
    return true;
};
    
//Determine if the brain already knows something.
Brain.prototype.knowsBasic = function(sentence, depth) {
    if(sentence[0] === 'be') {
        if(sentence[1][0] === 'all') {
            //all penguins are green, for example
            return this.adjectivesImply(sentence[1][1], sentence[2][1], depth);
        } else if(sentence[2][0] === 'all') {
            //the converse
            return this.adjectivesImply(sentence[2][1], sentence[1][1], depth);
        }
        //some penguins are green <=> there exists a green penguin
        return this.knowsExists(sentence[1][1].concat(sentence[2][1]), depth);
    } else {
        for(var i = 1; i < sentence.length; ++i) {
            //each argument satisfies its appropriate relative clause
            var prop = sentence.slice(0);
            prop[i] = 'it';
            if(sentence[i][0] === 'all') {
                //ensure that things in "all" imply that prop is true
                return this.adjectivesImply(sentence[i][1], [prop], depth);
            }
        }
        //if there are no universal statements, check each existential one
        for(var i = 1; i < sentence.length; ++i) {
            if(!this.hasTime()) return false;
            var prop = sentence.slice(0);
            prop[i] = 'it';
            var ex = sentence[i][1].concat([prop]);
            if(this.knowsExists(ex, depth)) return true;
        }
        return false;
    }
};
Brain.prototype.knows = function(sentence, depth, time) {
    if(depth === undefined) depth = Infinity;
    this.setStopTimeAhead(time);
    for(var dep = 0; dep <= depth; ++dep) {
        if(!this.hasTime()) return false;
        if(this.knowsBasic(sentence, dep)) return true;
    }
    return false;
};
//Tell the brain that something is true.
Brain.prototype.addKnowledge = function(sentence) {
    if(sentence[0] === 'be') {
        if(sentence[1][0] === 'all') {
            //all penguins are green <-> penguin implies green
            this.implications.push([sentence[1][1], sentence[2][1]]);
        }
        if(sentence[2][0] === 'all') {
            //the reverse
            this.implications.push([sentence[2][1], sentence[1][1]]);
        }
        //assume that the thing you're talking about exists
        this.addExists(sentence[1][1].concat(sentence[2][1]));
    } else {
        for(var i = 1; i < sentence.length; ++i) {
            var implied = sentence.slice(0);
            implied[i] = 'it';
            if(sentence[i][0] === 'all') {
                //add all relative clause implications
                this.implications.push([sentence[i][1], [implied]]);
            }
            //add all existential statements
            var ex = sentence[i][1].concat([implied]);
            this.addExists(ex);
        }
    }
};
