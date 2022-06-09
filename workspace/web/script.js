/**
 * Basic validator for question number input, will raise appropriate error for incorrect input
 * @param {str} val Value of question number input to validate
 */
function checkQN(val) {
    if (val < 1) {
        raiseError('generalSettings', 'A quiz must have at least one question.'); //0 or negative questions. DOES NOT CORRECT, but will not be able to build quiz
    } else if (val > 20) {
        raiseError('generalSettings', 'A quiz can only have 20 questions max.'); //More than 20. Manually sets question number to 20
        addSelectOptions(20);
        eel.generateMap(20); //Build py quizMap data for 20 questions
    } else {
        clearErrors('generalSettings'); //Valid choice 1 <= n <= 20, clear errors, generate py quizMap data
        addSelectOptions(val);
        eel.generateMap(val);
    };
}

/**
 * Basic validator for pass mark input, will raise appropriate error for incorrect input
 * @param {str} val Value of pass mark input to validate
 */
function checkPM(val) {
    if (val < 0) {
        raiseError('generalSettings', "You can't have a negative pass mark. It will be set to 0%."); //Negative pass mark. DOES NOT CORRECT, but will not be able to build quiz
    } else if (val > 100) {
        raiseError('generalSettings', 'The quiz pass mark will be set to the max 100%.'); //More than 100. Will manually set pass mark of 100 on build
    } else {
        clearErrors('generalSettings'); //Valid choice, clear errors
    };
}

/**
 * Triggers python function to get path using file dialog. Callback sets quiz data to include image path for build
 */
function getPathToFile() {
    eel.findImagePath()(path => {
        let qNumber = document.getElementById('questionNumber').value;

        fileName = path.split('/').pop();
        document.getElementById('imagePath').innerText = fileName; //Show name of file in front end so user knows they've selected

        eel.setQuestion(qNumber, 'imagePath', path);
    });
}

/**
 * Triggers the python getter to fill in the details of the selected question already written by user. 
 * Presents blank/no content if question hasn't been filled yet
 * @param {str} no Selected question number to load in the data for
 */
function selectQuestionNumber(no) {
    eel.getQuestion(no)(q => fillQuestionDetails(q));
}

/**
 * Actually fills in the frontend elements with question details from fetched question.
 * @param {object} q Question object returned by py backend to fill details in front end
 */
function fillQuestionDetails(q) {
    typeInput = document.getElementById('questionType');

    typeInput.value = q['questionType']; //Fill in selected question type in select

    selectQuestionType(q['questionType'])

    //setTimeout has to wait for py to fill dom. Promise does not seem to work
    setTimeout(() => {
        Object.keys(q['details']).forEach(k => {
            console.log(document.getElementById(k))
            try {
                document.getElementById(k).value = q['details'][k]; //Should work recursively via key/value pair fill for frontend
            } catch(e) {
                document.querySelector(`input[name=${k}]#${q['details'][k]}`).checked = true; //Any errors are radio/checkboxes, fill these in on catch
            }
        });
    }, 300);
}

/**
 * Sets the type for the current question and loads in the correct widget html for editing via the py backend
 * 
 * @param {str} type Type for the question (Input, MCQ, True/False)
 */
function selectQuestionType(type) {
    if (type === undefined || type === '') {
        //Failure to select a proper type, load in default message
        document.getElementById('questionContent').innerHTML = '<h3 style="text-align: center; vertical-align: center;">Pick a question type!</h3>';
    } else {
        qNumber = document.getElementById('questionNumber').value;
        eel.setQuestion(qNumber,'questionType',type);
        eel.getQuestionHTML(`web/snippets/${type}.html`)(html => {
            document.getElementById('questionContent').innerHTML = html; //Load in correct html widget to edit question
        });
        loadInTemplate(qNumber);
    };
}

/**
 * NOTE: NOT FOUND IN index.html. LOADED IN WITH THE INPUT WIDGET UNDER CURRENT QUESTION.
 * Sets type of the input with correctAnswer ID to selected value in triggering element e
 * 
 * e.g. this is triggered by radio element for 'Number' -> the 'correctAnswer' element is now type='number'
 * 
 * @param {HTMLInputElement} e Radio group element to select input type
 */
function handleInputRadio(e) {
    let target = document.getElementById('correctAnswer');
    target.value = '';

    target.setAttribute('type', e.value);
}

/**
 * Saves the question details in the py backend for the currently viewed question and generates a slide preview by triggering loadInTemplate()
 * 
 * No inputs; will do so for the question currently worked on/selected in the UI
 */
function saveQuestion() {
    const map = {
        'MCQ': ['question', 'correctAnswer', 'option2', 'option3'],
        'TrueFalse': ['question', 'correctAnswer'],
        'Input': ['question', 'answerType', 'correctAnswer', 'answerSuffix'] //Keys to update in the quizMap in py
    }
    let qType = document.getElementById('questionType').value;
    let qNumber = document.getElementById('questionNumber').value; //Get question number and type

    map[qType].forEach(id => {
        try {
            eel.setQuestionDetails(qNumber, id, document.getElementById(id).value) //Reason for map - easier to set question details recursively
        } catch(e) {
            eel.setQuestionDetails(qNumber, id, document.querySelector(`input[name=${id}]:checked`).value)
        };
    })

    loadInTemplate(qNumber); //Load slide preview
}

/**
 * Gathers all information from inputs to make quiz map in py backend and signals for quiz to be built and packaged
 * @returns null for any invalid information (cancels build)
 */

function buildQuiz() {
    //Quiz name input validation
    var quizName = document.getElementById('quizName').value;
    if (quizName.length < 1) {
        raiseError('generalSettings', 'You must name the quiz!');
        return null;
    };
    
    //Pass mark input validation
    var passMark = parseInt(document.getElementById('passMark').value);
    if (isNaN(passMark)) {
        raiseError('generalSettings', 'Please enter a valid pass mark.');
        return null;
    };

    //Question total validation
    var questionTotal = parseInt(document.getElementById('questionTotal').value);
    if (isNaN(questionTotal) || questionTotal < 1) {
        raiseError('generalSettings', 'Please add some questions to the quiz.');
        return null;
    }

    clearErrors('generalSettings');

    //Keep values within ranges
    if (passMark > 100) {
        passMark = 100;
    } else if (passMark < 0) {
        passMark = 0;
    };

    if (questionTotal > 20) {
        questionTotal = 20;
    };

    //Update Python quiz map
    const vars = { quizName, passMark, questionTotal };
    Object.keys(vars).forEach(key => eel.setGeneralDetails(key, vars[key])); //same as e.g. setGeneralDetails('quizName', quizName) over and over

    //Package and output quiz from Py
    eel.packageQuiz();
}

/**
 * Creates a child element for given el, with errorMessage class, and given msg as inner text
 * @param {str} el Element ID to add error message to as child
 * @param {StreamPipeOptions} msg Message for error element
 */
const raiseError = (el, msg) => {
    clearErrors(el); //Just clear any previous errors first

    let target = document.getElementById(el);

    const error = document.createElement('p');
    error.classList.add('errorMessage');
    error.innerText = msg;

    target.appendChild(error);
}

/**
 * Clears any direct child elements with the class 'errorMessage' from given el
 * @param {str} el Element ID to clear error children from
 */
const clearErrors = el => {
    let target = document.getElementById(el);

    Array.from(target.children).forEach(el => {
        if (Array.from(el.classList).includes('errorMessage')) { //If child el includes errorMessage class, remove
            el.remove();
        }
    })
}

/**
 * Updates the question select dropdown with question numbers based on how many the quiz is set to include
 * @param {str} no Number of questions for quiz, typically input by the user under General Settings
 */
const addSelectOptions = no => {
    let select = document.getElementById('questionNumber');
    select.innerHTML = '';

    for (let i = 1; i <= no; i++) {
        select.innerHTML += `<option value="${i}">${i}</option>` //Add options from 1 to question number
    };
}

/**
 * Basically carried out by py backend. Receives HTML widget for slide template and updates quiz window
 * @param {str} questionNumber Question number from the quiz data to render a template for
 */
const loadInTemplate = (questionNumber) => {
    eel.getTemplateHTML(`${questionNumber}`)(html => { //Unpack html in the py file, load via callback
        document.getElementById('quizWindow').innerHTML = html;
    });
}