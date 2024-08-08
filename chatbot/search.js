/*
 * search.js
 * Author: Jessica Taylor
 * This defined the SearchEnv class, which is used to make search problems
 * easier.  The SearchEnv allows adding actions that must be done as well as
 * branches, which allow different courses of action to be taken in case
 * something fails.  This is different from exception handling because the code
 * can "catch" a failure caused after it returns.  Here is an example:
 */
function testSearch() {
    var env = new SearchEnv();
    //env.stackActions stacks up actions that should be performed.
    //In this case we want to get a number, make sure it's 42, then print
    //a message, so we stack a function for each action.
    env.stackActions(function() {
            //note that this is used instead of env.  In the context of an
            //environment action, "this" refers to the current environment.
            
            //stackBranches adds something to do if a future computation
            //fails.  Computation will be resumed from this point after
            //executing the recovery actions.  In this case, it will try using 
            //42 instead of 5.
            this.stackBranches(function() {
                        console.log("oops, looks like 5 didn't work.  Trying 42 instead.");
                        this.pushData(42);
                    });
            this.pushData(5);
        }, function() {
            if(this.popData() !== 42) {
                console.log("Oh no, it isn't 42!");
                //Here fail is called.  This causes computation to resume
                //from the last branch stacked, or fail entirely if no branches
                //are left.  Note that env.fail() does not immediately cause
                //control to leave (the function has to return first), so
                //it is important to return afterwards.
                this.fail();
                return;
            }
            this.pushData("success!");
        }, function() {
            console.log(this.popData());
        });
    //env.run() returns true to indicate that the entire computation succeeded,
    //or false to indicate that the entire computation failed.
    if(env.run()) {
        console.log("The whole thing succeeded.");
    } else {
        console.log("The whole thing failed.");
    }
}

//These functions handle linked lists of the form [0, [1, [2, [3, null]]]].
//These linked lists make it more efficient to store the list of actions to do.
function listToArray(lst) {
    var arr = [];
    while(lst !== null) {
        arr.push(lst[0]);
        lst = lst[1];
    }
}
function arrayToList(arr, tail) {
    tail = tail || null;
    for(var i = arr.length - 1; i >= 0; --i) {
        tail = [arr[0], tail];
    }
    return tail;
}

//Make a shallow copy of an object.
function cloneObject(obj) {
    var res = {};
    for(var i in obj) res[i] = obj[i];
    return res;
}
//A queue data structure.  Behaves similar to an array for compatibility.
function Queue() {
    this.head = null;
    this.tail = null;
    this.length = 0;
}
//These methods are called push and pop instead of enqueue and dequeue so that
//you can a queue in place of a vector (stack).
Queue.prototype.push = function(item) {
    if(this.head === null) {
        this.head = this.tail = [item, null];
    } else {
        this.tail[1] = [item, null];
        this.tail = this.tail[1];
    }
    ++this.length;
};
Queue.prototype.pop = function(item) {
    if(this.head === null) {
        throw new Error("Cannot pop empty queue.");
    }
    var res = this.head[0];
    this.head = this.head[1];
    if(this.head === null) this.tail = null;
    --this.length;
    return res;
};
//The actual SearchEnv class.
function SearchEnv(branches) {
    //A linked list of actions left to do.
    this.actions = null;
    //A data structure (usualy stack/queue> of branches.  Each branch must have 
    //a member for actions, result, and data.  They represent returning the 
    //computation to the state when actions = branch.actions, 
    //data = branch.data.
    if(branches === undefined) branches = [];
    this.branches = branches;
    //Whether something has gone wrong that requires recovery or will terminate
    //the entire computation.
    this.failed = false;
    //User data.  Members of this.data should be set to hold data global to the
    //computation.  Data also contains a stack, which is a linked list used to
    //hold local data.
    this.data = {'stack': null};
}
SearchEnv.prototype.toString = function() {
    var res = ["SearchEnv ("];
    if(this.failed) {
        res.push("failed");
    } else {
        res.push("succeeded");
    }
    res.push(")");
    //res.push("\nActions:\n");
    //res.push('' + this.actions);
    //res.push("\nBranches:\n");
    //res.push('' + this.branches);
    res.push("\nData:\n");
    for(var i in this.data) {
        res.push(i);
        res.push(" = ");
        res.push('' + this.data[i]);
        res.push("\n");
    }
    return res.join('');
};
SearchEnv.prototype.clone = function() {
    var res = new SearchEnv();
    res.actions = this.actions;
    res.branches = cloneObject(this.branches);
    res.failed = this.failed;
    res.data = cloneObject(this.data);
    return res;
};
//Stacks up actions to perform, with the first argument being performed first.
SearchEnv.prototype.stackActions = function() {
    for(var i = arguments.length - 1; i >= 0; --i) {
        if(typeof arguments[i] != 'function') {
            throw new Error("Action is not a function : " + arguments[i]);
        }
        this.actions = [arguments[i], this.actions];
    }
};
//Stacks up branches to take, with the first argument being taken first.
//Each argument is a list of actions taken to recover.
SearchEnv.prototype.stackBranches = function() {
    for(var i = arguments.length - 1; i >= 0; --i) {
        if(typeof arguments[i] != 'function') {
            throw new Error("Branch is not a function : " + arguments[i]);
        }
        this.branches.push(
{//freeze the state of computation at this time to be reinstated later.
    'actions' : [arguments[i], this.actions],
    'data' : cloneObject(this.data)});
    }
};
//For pushing/popping/peeking from the data stack.
SearchEnv.prototype.pushData = function(item) {
    this.data.stack = [item, this.data.stack];
};
SearchEnv.prototype.peekData = function() {
    var top = this.data.stack;
    if(top === null) return undefined;
    return top[0];
};
SearchEnv.prototype.popData = function() {
    var top = this.data.stack;
    if(top === null) return undefined;
    this.data.stack = top[1];
    return top[0];
};
//Note: many functions take some arguments and then return a function.
//The function they return can be manipulated easily and used as an argument
//to stackActions or stackBranches.


//Perform one of the actions.  The result will be whatever is left on the stack
//by a succeeding action.
function chooseOne() {
    var options = arguments;
    return function() {
        //This is a somewhat lazy/clever way to ensure that the first branch is
        //taken but that the rest are added to the branches to be taken in case
        //the first one fails.
        this.stackBranches.apply(this, options);
        this.fail();
    };
}
function doAll() {
    var todo = arguments;
    return function() {
        this.stackActions.apply(this, todo);
    };
}
//Perform all of the actions, collecting the results into an array.
function collectAll() {
    var toCollect = arguments;
    return function() {
        this.stackActions(function() {
                var res = [];
                for(var i = 0; i < toCollect.length; ++i) {
                    res.push(this.popData());
                }
                res.reverse();
                this.pushData(res);
            });
        this.stackActions.apply(this, toCollect);
    };
};
        
//Cause the current computation to fail.
SearchEnv.prototype.fail = function() {
    this.failed = true;
};
//Execute one step in the environment (either executing an action or recovering
//from failure).  Returns true iff there is more work to do in the computation.
SearchEnv.prototype.step = function() {
    if(this.failed) {
        if(this.branches.length === 0) return false;
        var top = this.branches.pop();
        //reinstate state from the top branch
        this.actions = top.actions;
        this.data = top.data;
        this.failed = false;
        return true;
    } else {
        if(this.actions === null) return false;
        //execute the next action
        var action = this.actions[0];
        this.actions = this.actions[1];
        //action.call(this) causes "this" in the context of the action to refer
        //to the current environment.
        action.call(this);
        return true;
    }
};
//Runs a computation to its finish.  Returns true iff the computation succeeded.
SearchEnv.prototype.run = function() {
    while(this.step()) { }
    return !this.failed;
};
