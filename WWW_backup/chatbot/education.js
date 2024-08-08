function addEducation(brain) {
    for(var i = 0; i < education.length; ++i) {
        var edu = education[i];
        generatemarkov(edu);
        var tokens = tokenizePOS(edu);
        var parsed = parse(tokens);
        if(parsed === null) {
            console.log("Bad education: " + edu);
            continue;
        } 
        var sentence = toSentence(parsed);
        if(sentence[0] !== 'declaration') {
            console.log("Bad education: " + edu);
            continue;
        }
        brain.addKnowledge(sentence[1]);
    }
}

var education = 
    ["you are a chatbot",
     "you are a program",
     "you are a computer",
     "I am a human",
     "I am a person",
     "people are mammals",
     "mammals have legs",
     "animals that have legs walk",
     "birds are animals",
     "birds fly",
     "mammals are animals",
     "llamas are mammals",
     "computers are technology",
     "everything that walks moves",
     "technology is fun",
     "stanford is a fun college",
     "ihum is a fun class",
     "fun things are good",
     "jessica likes everything good",
     "pat likes everything good",
     "you like everything good",
     "students are people",
     "students are in college",
     "freshmen are students",
     "jessica is a freshman at Stanford",
     "pat is a freshman at Stanford",
     ]
