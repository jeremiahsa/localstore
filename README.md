localstore
==========

Local Store is a module that uses web sql to store forms and attachments on the client side. It is useful as a failsafe for limited connectivity on mobile devices.


Configuration:
    1. Set database name for the client side database.
        db = openDatabase('ms4mobile', '1.1', 'MS4 Web Storage', 3 * 1024 * 1024);
    2. Set URL for your file uploads.
        var url = encodeURI('https://ms4.ms4front.net/mobileapp.php'); 

Initialization:
Initialization is automatically done when the module is called. For each application, you will need to specify a different database name, version number, and long name. The database tables will automatically be created. 





Storing Forms:
To store a form, call
    
    localstore.initializeForm(id, formLabel, editNew);

id should be the unique jquery id of the form. The function will capture the inputs from the form and 
formLabel - This is the label to use for the outbox items. You can set it to whatever you want to help the user recognize the items in the outbox.
editNew - This is used to indicate whether the record being saved is a new record or an edit of an existing record.
This stores the form in the client side database, but the process is not complete.

To complete the form storage, you need to call an aditional function:

    localstore.markFormAsSaved(formName, data);
    
formName - The same jquery ID of the form being saved.
data - The data object from the server. It should be in JSON format and contain this structure:
    
    data = {
        "inspectionid": 14
    }

The inspection id is optional, but can be used to update the client-side id of a newly created object before the attachments are uploaded to the server. The other thing that this function does is indicate that the object has been saved so that it will not show up in the outbox.


Capturing Images:
Capturing images hooks into an attachments table to save the form data along with the photo. The photo is saved for upload on the device as long as the app is not closed completely. Each photo will upload on its own through the module.
    
    localstore.captureImage(event, editNew, formId, projectid, table, gallery, source);
    
event - This is the javascript event object from the button click. 
editNew - This indicates whether the parent form is creating a new object or editing an existing object.
formId - The jQuery ID of the form object. This needs to match the form being stored in order for the file to upload.
projectid - This is the unique id of the record (foreign key) for the object being saved.
table - The name of the table on the server (This may or may not be useful and can be ignored on the server side)
gallery - the javascript ID of the image gallery if you wish to have a thumbnail show up after the image is captured.
source - Optional argument to determine the source of the image capture, whether camera or photo library.
    Camera.PictureSourceType.CAMERA
    Camera.PictureSourceType.PHOTOLIBRARY



Error Logging:
For debugging purposes, the console logs sql query results and errors.



Outbox:
To send all unsaved records through the outbox, only a simple call of localstore.sendAllUnsaved() is required. Localstore will loop through all records in the client side database and convert each one back into a form data object before submitting it to the server.

To get all of the labels for the outbox, call localstore.getLabels(). The callback will return a list of items to loop through. Each item will have a label and an index for the label. 

deleteAll
Simple function to clear out all records on the client-side database. It also removes images from the app's temporary folder. 

allForms
Simple function which logs the items in the outbox. This can be modified to return the results via a callback. 
allUploads
Simple function to show all uploads in the outbox. This could be modified to return the results as a callback.

