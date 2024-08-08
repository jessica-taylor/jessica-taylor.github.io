var currentBot = undefined;
function setCurrentBot() {
    if(currentBot === undefined) {
        currentBot = makeBot();
    }
}
function addLineToConversation(line) {
    var conversation = document.getElementById('conversation');
    //use appendChild instead?
    conversation.innerHTML += '<p>' + line + '</p>';
    conversation.scrollTop = conversation.scrollHeight;
}
 
function registerUserSaid() {
    setCurrentBot();
    var saidInput = document.getElementById('userSaid');
    var said = saidInput.value;
    saidInput.value = '';
    addLineToConversation('<strong>You:</strong> ' + said.escapeHTML());
    var response;
    try {
        response = currentBot.respond(said);
    } catch(ex) {
        response = "Sorry, I'm really confused by what you said.";
    }
    addLineToConversation('<p><strong>Bot:</strong> ' + response.escapeHTML());
}
function checkPressedEnter(evt) {
    var code = window.event? /* IE */ evt.keyCode : evt.which;
    if(code === 13) {
        registerUserSaid();
    }
}
function respondToInterjection(base) {
    switch(base) {
    case 'hi': return 'Hello.';
    case 'bye': return 'Goodbye.';
    case 'yay': return 'What are you so excited about?';
    case 'yes': return 'Ok.';
    case 'no': return 'Ok.';
    case 'darn': return "What's wrong?";
    case 'forget': return "I forgot everything I know.";
    case 'reset': return "I forgot everything you told me.";
    }
}
var MAX_DEPTH = 2;
var ALLOWED_TIME = 2000; //ms
var DEBUG = false;
function makeBot() { 
    var brain = new Brain();
    addEducation(brain);
    function respond(msg) {
        var tokens = tokenizePOS(msg);
        var res = '';
        if(DEBUG) {
            for(var i = 0; i < tokens.length; ++i) {
                res += tokens[i].join('/');
                res += ' ';
            }
            res += ' | ';
        }
        var parsed = parse(tokens);
        if(DEBUG) res += treeString(parsed) + ' | ';
        if(parsed === null) {
            res += "I don't know what that means.";
            return res;
        }
        var sentence = toSentence(parsed);
        if(DEBUG) res += treeString(sentence) + ' | ';
        if(sentence[0] === 'interjection') {
            switch(sentence[1]) {
            case 'forget':
                brain = new Brain();
                break;
            case 'reset':
                brain = new Brain();
                addEducation(brain);
                break;
            }
            res += respondToInterjection(sentence[1]);
            return res;
        } else if(sentence[0] === 'declaration') {
            if(brain.knows(sentence[1], MAX_DEPTH, ALLOWED_TIME)) {
                res += "Yes, that's right.";
            } else {
                res += "That's interesting.";
                brain.addKnowledge(sentence[1]);
            }
        } else if(sentence[0] === 'question') {
            if(brain.knows(sentence[1], MAX_DEPTH, ALLOWED_TIME)) {
                res += "Yes.";
            } else {
                res += "I don't know.";
            }
        }
        res+=generatenext(msg);
        generatemarkov(msg);

        return res;
    }
    return {'respond' : respond};
}
