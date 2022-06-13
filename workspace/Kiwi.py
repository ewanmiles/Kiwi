import random, os, shutil, json

#Package install if necessary
print("Checking packages...")
with open('package.json', 'r') as f:
    packages = json.load(f)
    for (k,v) in packages.items():
        if v == False:
            print(f'{k} may not be installed. Downloading it to your system. Installer: pip')
            os.system(f'pip install {k}')
            packages[k] = True

with open('package.json', 'w') as f:
    json.dump(packages, f, indent=2)

import wx
import eel
import requests

eel.init("web") #Initialise front end files from web dir
DESKTOP_PATH = os.path.join(os.path.join(os.environ['USERPROFILE']), 'Desktop')

#Clear images folder by deleting full tree followed by mkdir
if os.path.exists('web/images'):
    shutil.rmtree('web/images')

os.mkdir('web/images')

#Clear stylesheet from previous build if somehow exists
if os.path.exists('./style.css'):
    os.remove('./style.css')

def copytree(src, dst, symlinks=False, ignore=None):
    """
    Generously inspired by StackOverflow as shutil.copytree doesn't really work.
    Copy file contents from src to dst, both str path inputs
    """
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, symlinks, ignore)
        else:
            shutil.copy2(s, d)

@eel.expose
def findImagePath(wildcard="*"):
    """
    Opens a file dialog to select an image from user's file system, copies the image to the web/images dir and returns that path.
    No inputs, but optional to change wildcard input (default *).
    """

    app = wx.App(None) #Necessary to open filedialog!!
    style = wx.FD_OPEN | wx.FD_FILE_MUST_EXIST
    dialog = wx.FileDialog(None, 'Open', wildcard=wildcard, style=style) #File dialog window
    if dialog.ShowModal() == wx.ID_OK:
        path = dialog.GetPath() #Get path from chosen file
    else:
        path = None
    dialog.Destroy()

    newDest = os.path.join('web/images/', os.path.basename(path)) #Create new path to image folder in web/
    shutil.copy(path, newDest) #Copy chosen image over

    return newDest

@eel.expose
def getQuestionHTML(fileName):
    """
    Very basic - opens a given HTML file and reads its contents to one string, encoded to utf-8, input
    
        - fileName (str): file path to open

    Returns read file as string. Obviously will not work if file is unreadable or cannot be extracted using Python func .read()
    """
    with open(fileName, 'r', encoding='utf-8') as f:
        asString = f.read()

    return asString

@eel.expose
def getTemplateHTML(questionNumber):
    """
    Opens the correct HTML snippet for the given question and replaces the contents with the quiz data, input

        - questionNumber (str): Question to unpack (REMEMBER THIS STARTS AT '1'), also used as key in quizMap object

    Returns the HTML slide for the given question (this is the slide preview) as one string
    """

    try: #quizMap exists, no question data
        if len(list(quizMap[questionNumber]['details'].keys())) < 1: #Loading in a blank template/unsaved question, nothing to return, avoids errors thrown
            return 'Build and save a question to see the slide!'
    except (NameError, KeyError) as e: #First/second stage error, no quizMap object yet or no question key yet
        return 'Build and save a question to see the slide!'


    with open('web/snippets/template.html', 'r', encoding='utf-8') as f: #Read in slide template
        asString = f.read()

    try:
        asString = asString.replace('[IMAGE]', quizMap[questionNumber]['imagePath']) #Add image path to template
    except KeyError:
        asString = asString.replace('<img src="[IMAGE]"/>', '') #No image selected, thus no 'imagePath' key, remove placeholder

    #Replace question placeholder and get question type (MCQ/TF/Input)
    asString = asString.replace('[QUESTION]',quizMap[questionNumber]['details']['question'])
    qType = quizMap[questionNumber]['questionType']

    #Basically a switch case to replace necessary elements for each one
    if qType == 'TrueFalse':
        with open('web/snippets/widgets/tf.html', 'r', encoding='utf-8') as f: #Read in true false html
            widget = f.read()

        asString = asString.replace('[INSERTS]', widget)
    elif qType == 'Input':
        with open('web/snippets/widgets/input.html', 'r', encoding='utf-8') as f: #Read in input html
            widget = f.read()

        asString = asString.replace('[INSERTS]', widget)
        asString = asString.replace('[SUFFIX]', quizMap[questionNumber]['details']['answerSuffix'])
        asString = asString.replace('[ANSWERTYPE]', quizMap[questionNumber]['details']['answerType'])
    elif qType == 'MCQ':
        with open('web/snippets/widgets/mcq.html', 'r', encoding='utf-8') as f: #Read in mcq html
            widget = f.read()

        questions = [quizMap[questionNumber]['details']['correctAnswer'],
                                quizMap[questionNumber]['details']['option2'],
                                quizMap[questionNumber]['details']['option3']] #Build array of MCQ answers and shuffle them
        random.shuffle(questions)

        for i in range(3):
            widget = widget.replace(f'[OPTION{i+1}]', questions[i]) #Put the questions in the slide HTML

        asString = asString.replace('[INSERTS]', widget)

    return asString

@eel.expose
def getSlideCSS():
    """
    Unpacks the editable slide css and puts it in the Kiwi editor ready for users to directly edit slide appearance.
    Returns the portion of the example template stylesheet for slide CSS, starting on the line '.slide, .endSlide {'
    """

    with open('example/style.css', 'r') as f:
        styles = f.read()

    startLocation = styles.find('.slide, .endSlide') #Skip to just slide CSS

    return styles[startLocation:]

@eel.expose
def saveNewStylesheet(newStyles):
    """
    Takes user's input css styles for the slides and generates a new stylesheet for the output; input

        - newStyles (str): Style rules for the slides taken from the front end

    The stylesheet is NOT packaged into the output here; that is in packageQuiz()
    """

    with open('example/style.css', 'r') as f:
        styles = f.read()

    endLocation = styles.find('.slide, .endSlide') #Skip to just slide CSS
    newSheet = styles[:endLocation] + newStyles

    #Save new stylesheet
    with open('style.css', 'w') as f:
        f.write(newSheet)

@eel.expose
def generateMap(number):
    """
    Either updates the quizMap object to add new questions, or initialises a blank one.
    A new one is initialised if 'quizMap' cannot be found in the global variables; input

        - number (str): Number of questions to initialise in the quizMap. If there are already questions in the quiz map,
                        these should not be affected; it will remove down to the number or add blank questions beyond the ones that already exist

    No return, but prints quizMap to console (mainly for debugging)
    """
    global quizMap

    if 'quizMap' in list(globals()):
        mapKeys = list(quizMap.keys()) #Questions already in quizMap
        totalKeys = len([i for i in mapKeys if i not in ['quizName', 'passMark', 'questionTotal']]) #Ignore these keys, tally total

        if int(number) > totalKeys:
            for i in range(totalKeys+1, int(number)+1):
                quizMap[f'{i}'] = {'questionType': '', 'details': {}} #Add new blank questions if more than already existing

        elif int(number) < totalKeys:
            for i in range(int(number)+1, totalKeys+1): #Trim down to number of questions if some removed, use del operator
                del quizMap[f'{i}']

    #quizMap object doesn't exist yet, make new blank with given number of questions
    else:
        quizMap = {}
        for i in range(1, int(number)+1):
            quizMap[f'{i}'] = {'questionType': '', 'details': {}}

    print(quizMap) #Print for debug

@eel.expose
def packageQuiz():
    """
    Uses the example/ folder to actually build the quiz from the content sent through the frontend, packaging it into a folder
    in the KiwiOutput folder generated on the user's desktop. quizMap object gets saved to external JSON while writing the quiz,
    this is unpacked and added to the JS script in output. No inputs.
    """
    #Check for output path on Desktop
    deskPath = f'{DESKTOP_PATH}/KiwiOutput'
    if (os.path.exists(deskPath) == False):
        os.mkdir(deskPath)

    #Dir for quiz file
    outPath = f'{deskPath}/{quizMap["quizName"]}'
    if os.path.exists(outPath):
        os.rmdir(outPath)
    
    os.mkdir(outPath) #We're overwriting! Be aware

    #Copy images dir
    os.mkdir(f'{outPath}/images')
    for i in os.listdir('web/images'):
        shutil.copy2(os.path.join('web/images',i), f'{outPath}/images')

    #Rewrite script to add quizContext in example
    with open('example/script.js', 'r') as fjs:
        lineList = fjs.readlines()
    with open('QM.json', 'r') as fjson:
        toAdd = json.load(fjson)

    for ind, l in enumerate(lineList):
        if 'const quizContext' in l:
            lineList[ind] = f"const quizContext = {toAdd};\n" #Actually replace the context

    #Turn to one string and minify, then write
    minifyAPI = 'https://www.toptal.com/developers/javascript-minifier/raw' #API handling it
    minified = requests.post(minifyAPI, data=dict(input=''.join(lineList))).text
    with open('script.js', 'w') as f:
        f.write(minified)

    copytree('./example', outPath)
    shutil.copy2('./script.js', outPath) #Replace with new script
    os.remove('./script.js')

    #If user edited stylesheet, copy that over and delete
    if os.path.exists('./style.css'):
        shutil.copy2('./style.css', outPath)
    os.remove('./style.css')

#Simple getters/setters for accessing questions in the QuizMap object and communicating with the JS
@eel.expose
def setGeneralDetails(key, value):
    quizMap[key] = value

    with open('QM.json', 'w') as f:
        json.dump(quizMap, f, indent=2) #Write quizMap object to external file QM.json simultaneously (avoid dataloss/used later to package quiz)

@eel.expose
def setQuestion(number, key, value):
    if key == 'imagePath':
        quizMap[number][key] = os.path.relpath(value, 'web') #Need relative path here not given value
    else:
        quizMap[number][key] = value

@eel.expose
def setQuestionDetails(number, key, value):
    quizMap[number]['details'][key] = value

    with open('QM.json', 'w') as f:
        json.dump(quizMap, f, indent=2) #Write quizMap object to external file QM.json simultaneously (avoid dataloss/used later to package quiz)
 
@eel.expose
def getQuestion(number):
    return quizMap[number]

if __name__ == '__main__':
    eel.start("index.html", size=(1300, 850), port=8080) #Other programs such as MAGI default to 8000, this allows synchronous running