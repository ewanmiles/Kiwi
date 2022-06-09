/*HTML Widgets to replace slide template when question is selected*/
//We're not hosting on a server, so we have to hardcode any content that we want to hide from the DOM because of SOP/CORS
//It doesn't stay hidden as the user can read script.js, so the script is minified to make it difficult
//SHOULD HAVE BUILT THIS IN ANGULAR!! But painful to use framework for a small project like this
const slideTemplate = '<div class="slide">\n\t[IMAGE]\n\t<p>[QUESTION]</p>\n\t[INSERTS]\n\t<input type="submit" value="Submit" onclick="submitAnswer()">\n</div>';
const inputWidg = '<div class="flexcenter">\n\t<input type="[ANSWERTYPE]" style="width: 60%">\n\t[SUFFIX]\n</div>';
const mcqWidg = '<div class="flexeven flexwrap">\n<div class="flexcenter">\n\t<label for="true">[OPTION1]</label>\n\t<input type="radio">\n</div>\n<div class="flexcenter">\n\t<label for="false">[OPTION2]</label>\n\t<input type="radio">\n</div>\n<div class="flexcenter">\n\t<label for="false">[OPTION3]</label>\n\t<input type="radio">\n</div>\n</div>';
const tfWidg = '<div class="flexeven">\n<div class="flexcenter">\n\t<label for="true">True</label>\n\t<input type="radio" id="true" value="true">\n</div>\n<div class="flexcenter">\n\t<label for="false">False</label>\n\t<input type="radio" id="false" value="false">\n</div>\n</div>';

const widgetMap = {
    'MCQ': mcqWidg,
    'Input': inputWidg,
    'TrueFalse': tfWidg
};

//Heavily inspired by StackOverflow (harmlessly!)
function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle
    while (currentIndex != 0) {
  
      // Pick a remaining element
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
};

const quizContext = {}; //The data for all the quiz will be added here on build

var answerContext = {
    'correctTotal': 0,
    'incorrectTotal': 0,
    'percentage': 0
}; //The data for the answers given will be tallied here

const QUIZ_LENGTH = quizContext['questionTotal'];

const updateAnswerContext = (qNumber, bool, answer) => {
    answerContext[qNumber] = [answer, bool] //Track answer by answer, e.g '1': [answer, false], '2': [answer, true]...

    boolMap = {'true': 'correctTotal', 'false': 'incorrectTotal'};
    answerContext[boolMap[String(bool)]] += 1 //e.g. if false, incorrectTotal += 1

    //Simple if statement for percentage calc, need to catch 0 just in case somehow correct + incorrect = 0
    answerContext['correctTotal'] < 1 ? 
        answerContext['percentage'] = 0 : 
        answerContext['percentage'] = (100*answerContext['correctTotal'])/(answerContext['correctTotal'] + answerContext['incorrectTotal']);
}

const loadInQuestion = number => {
    document.querySelector('body').innerHTML = slideTemplate; //Clear back to slide template
    
    let question = quizContext[number];
    let slide = document.getElementsByClassName('slide')[0]; //Slide div

    slide.setAttribute('id', `${number}`); //Give slide id of question number
    slide.innerHTML = slide.innerHTML.replace('[INSERTS]', widgetMap[question['questionType']]); //Find [INSERTS] in HTML to replace with widget

    fillWidget(question, number);
};

const fillWidget = (question, number) => {
    slide = document.getElementById(number);
    slide.innerHTML = slide.innerHTML.replace('[QUESTION]', question['details']['question']); //Write question from map

    if (Object.keys(question).includes('imagePath')) {
      slide.innerHTML = slide.innerHTML.replace('[IMAGE]', `<img src="${question['imagePath']}"/>`);
    } else {
      slide.innerHTML = slide.innerHTML.replace('[IMAGE]', ''); //Update image path in HTML if there, otherwise delete placeholder
    }

    switch (question['questionType']) {
        case 'MCQ':
            let answerArray = shuffle([question['details']['correctAnswer'], //Shuffle MCQ answers so they appear in a different order on each run
                                        question['details']['option2'], 
                                        question['details']['option3']]);

            let labels = document.querySelectorAll('label');
            for(let i = 1; i < 4; i++) {
                labels.forEach(el => {
                    if (el.innerText.includes(`[OPTION${i}]`)) {
                        el.innerText = answerArray[i-1];
                        el.setAttribute('for', answerArray[i-1]); //Label text and 'for' attr replaced
                        
                        let input = el.nextSibling.nextSibling;
                        input.setAttribute('id', answerArray[i-1]); //Answer ID for corresponding radio element (two els across)
                        input.setAttribute('name', number); //Radio group name is question number from quizContext
                        
                    };
                });
            };
            break;

        case 'Input':
            if (question['details']['answerSuffix'].length > 0) { //If suffix, replace with HTML line, else clear
                slide.innerHTML = slide.innerHTML.replace('[SUFFIX]',`<p style="margin-left: 5px;">${question['details']['answerSuffix']}</label>`);
            } else {
                slide.innerHTML = slide.innerHTML.replace('[SUFFIX]', '');
            };

            slide.innerHTML = slide.innerHTML.replace('[ANSWERTYPE]', question['details']['answerType']);
            document.querySelector(`input[type="${question['details']['answerType']}"]`).setAttribute('name', number); //Give input question number name attr
            break;

        case 'TrueFalse':
            let inputs = slide.querySelectorAll('input[type="radio"]'); //Only thing to do is give inputs name attr = question number
            inputs.forEach(el => el.setAttribute('name', number));
            break;
    };
};

const startQuiz = () => {
    document.querySelector('body').innerHTML = slideTemplate; //Clear start slide to slide template and load in first question
    loadInQuestion('1');
};

const submitAnswer = () => {
    let thisQuestion = document.querySelector('.slide').id;
    const submitButton = document.querySelector('input[type="submit"]');

    if (validateQuestion(thisQuestion)) { //If correct answer, validateQuestion returns true and this is run
        showFeedback('Correct, well done!', 'correctFeedback');
    } else { //Incorrect/invalid answer, validateQuestion returns false
        showFeedback(`Sorry, that\'s incorrect. The correct answer was ${quizContext[thisQuestion]['details']['correctAnswer']}.`, 'incorrectFeedback');
    }

    //Change event callback to continueQuiz, this.parentElement.id is slide ID
    submitButton.setAttribute('onclick', 'continueQuiz(this.parentElement.id)');
    submitButton.value = 'Continue';
};

const continueQuiz = (thisQuestion) => {
    let nextQuestion = `${parseInt(thisQuestion) + 1}`; //Parses question number to int, adds one, returns to string via template literal
    
    if (nextQuestion > QUIZ_LENGTH) {
        endQuiz();
    } else {
        loadInQuestion(nextQuestion); //If question not beyond quiz length, load in next
    };
};

const validateQuestion = (qNumber) => {
    let inputs = Array.from(document.getElementsByName(qNumber));

    if (inputs.length < 2) { //Only case of single text/number input
        var answer = inputs[0].value;
        var trueAnswer = quizContext[qNumber]['details']['correctAnswer'].toLowerCase().replace(/\s/g, ""); //Remove whitespace and decapitalize
        if (answer.toLowerCase().replace(/\s/g, "") == trueAnswer) {
            updateAnswerContext(qNumber, true, answer);
            return true;
        };

    } else { //Case of T/F or MCQ
        var answer = document.querySelector(`input[name="${qNumber}"]:checked`).id;
        if (answer == quizContext[qNumber]['details']['correctAnswer']) { //Simply try to match answer
            updateAnswerContext(qNumber, true, answer);
            return true;
        };
    };

    updateAnswerContext(qNumber, false, answer);
    return false; //Default to return false if answer doesn't match
};

const showFeedback = (msgText, boxClass) => {
    const messageBox = document.createElement('div');
    const message = document.createElement('p');

    message.innerText = msgText;
    messageBox.classList.add(boxClass);

    messageBox.appendChild(message);
    document.querySelector('.slide').appendChild(messageBox);
};

const endQuiz = () => {
    const body = document.querySelector('body');

    body.innerHTML = '';
    const endSlide = document.createElement('div'); //Clear body and replace with end slide
    endSlide.classList.add('endSlide');

    body.appendChild(endSlide);

    let msg = document.createElement('p'); //Success/fail message element
    endSlide.appendChild(msg);

    if (answerContext['percentage'] >= quizContext['passMark']) { //Add message itself
        msg.innerText = 'Congratulations, you passed the quiz!';
    } else {
        msg.innerText = 'Unfortunately you failed the quiz.';
    };

    let passMark = document.createElement('p'); //Your percentage vs. pass mark
    endSlide.appendChild(passMark);

    passMark.innerText = `Pass mark: ${quizContext['passMark']}% | Your mark: ${Math.round(answerContext['percentage'] * 10) / 10}%`;

    const answerBreakdown = document.createElement('div'); //Div for answer breakdown UI
    answerBreakdown.classList.add('flexwrap');
    endSlide.appendChild(answerBreakdown);

    for (let i = 1; i < QUIZ_LENGTH+1; i++) {
        let answerPanel = document.createElement('div'); //Answer panel contains your answer, correct answer, qNumber
        answerPanel.classList.add('answerPanel');

        let icon = document.createElement('div');
        let text = document.createElement('p');
        icon.classList.add('icon');

        if (answerContext[`${i}`][1]) {
            answerPanel.classList.add('correct'); //Check if the answer was correct or incorrect and give class accordingly
        } else {
            answerPanel.classList.add('incorrect');
        }

        icon.innerText = i; //Text for panel, i is question number
        text.innerText = `Your answer: ${answerContext[String(i)][0]}\nCorrect answer: ${quizContext[String(i)]['details']['correctAnswer']}`;

        answerPanel.appendChild(icon);
        answerPanel.appendChild(text);

        answerBreakdown.appendChild(answerPanel);
    }
};