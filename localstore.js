//requires jquery
/*
 * For database operations, it is important not to try to pass more arguments to the
 * function. Otherwise, the functions will not work.
 * Insert Arguments: (query, variables, success callback);
 * UPDATE Arguments: (query, variables, success callback, fail callback);

 */
define(['jquery', 'wq/store', 'wq/spinner'], // #Removed 'util'
function($, ds, spin) {

var localstore = {};
var db;
var unsavedForms = {};

/********************
 * Helper Functions
 *******************/

	function setNull(arg) {
		if(typeof(arg)==='undefined') {
			return null;
		} else {
			return arg;
		}
	}
	function sqlError(err) {
		console.log('Error executing SQL');
		console.log(err);
	}
	function logSql(tx, results) {
		console.log('logging sql');
		console.log(results);
		if (typeof(results.insertId) != undefined) {
			console.log('inserted: ' + results.insertId);
		} else {
			console.log('logging sql');
			for (var i = 0; i <= results.rows.length; i++) {
				console.log(results.rows.item(i));
			}
		}
	}
	function _render() {
		$('#outbox-resend').show();
		var listdiv = $('#outbox-list');
		localstore.getLabels(function(list) {
			var html = "<ul data-role='listview'>";
			if (!list || list.length == 0) {
				html += "<li>No items.</li>";
			} else {
				$.each(list, function(i, row) {
					var icon;
					var amsg;
					var href;
					var rmsg;
					if (row.saved == "false" && row.label !== "Login Attempt") {
						html += (  "<li data-icon='alert' data-iconpos='left'> <a href='javascript:void(null);'>New " + row.label + "</a></li>");
					}
				});
			}
			html += "</ul>";
			$(html).appendTo(listdiv.empty()).listview();
		});
	}

/***********************
 * DATABASE OPERATIONS *
 **********************/
	localstore.maxId;
	
	localstore.initializeDB = function() {
		if (window.openDatabase) {
			console.log('window.openDatabase successful');
			try {
				db = openDatabase('drainagedb03', '0.3', 'DrainageDB Web Storage', 3 * 1024 * 1024);
				db.transaction(function(tx) {
					console.log('transaction started');
					tx.executeSql("CREATE TABLE IF NOT EXISTS Forms (id INTEGER PRIMARY KEY, fkey TEXT UNIQUE, fval TEXT, fdate TEXT, fsaved TEXT, label TEXT, inspectionId TEXT, editNew TEXT, projectid TEXT);");
					tx.executeSql("CREATE TABLE IF NOT EXISTS Uploads (id INTEGER, filename TEXT, formKey TEXT, inputName TEXT, usaved TEXT, projectid TEXT, inspectionId TEXT, editNew TEXT, servertable TEXT);");
					tx.executeSql("SELECT max(id) AS max_id FROM Forms;", [], function(tx, results) {
						localstore.maxId = results.rows.item(0).max_id + 1;
					}, function(tx, error) {
						console.log('error retrieving max id');
						localstore.maxId = 1;
					});
				});
			} catch (e) {
				console.log('failed to create database tables: ' + e);
				console.log(e);
			}
		} else {
			console.log('database not opened');
			//alert('Your Browser does not support Web SQL Storage');
		}
	}
	localstore.initializeDB()
	
	localstore.updateMaxId = function() {
		function m_id() {
			db.transaction(function(tx) {
				tx.executeSql("SELECT max(id) AS max_id FROM Forms;", [], function(tx, results) {
					localstore.maxId = results.rows.item(0).max_id + 1;
				}, function(tx, error) {
					console.log('error retrieving max id');
					localstore.maxId = 1;
				});
			});
		}
	}
	
	localstore.storeForm = function(formName, id, editNew) {
		console.log('id: ' + id);
		if (typeof(editNew) === 'undefined') {
			editNew = '';
		}
		var form = JSON.stringify(formName);
		try {
			db.transaction(function(tx) {
				tx.executeSql("INSERT INTO Forms (fkey, fval, fdate, fsaved, editNew) VALUES (?, ?, ?, ?, ?);", [id, form, $.now(), 'false', editNew], function(tx, results) {
					localstore.updateMaxId;
				}, function(tx, error) {console.log('error inserting record'); console.log(error)});
			});
		} catch(e) {console.log('insert failed: ' + e);}
	}
		
	localstore.getLabels = function(callback) {
		db.transaction(function(tx) {
			tx.executeSql("SELECT label, fsaved FROM Forms WHERE fsaved != 'true';", [], function(tx, results) {
				loguploads(tx);
				var labels = [];
				if (results.rows.length == 0) {
				}
				for (var i = 0; i < results.rows.length; i++) {
					var row = {
						'saved': results.rows.item(i).fsaved,
						'label': results.rows.item(i).label
						}
					labels.push(row);
				}
				callback(labels);
			});
		});
		return false;
	}
	
	function loguploads(tx) {
		console.log('uploads');
		tx.executeSql("SELECT * FROM Uploads;", [], function(tx, results) {
			for (var j=0; j < results.rows.length; j++) {
				console.log(results.rows.item(j))
			}
		})
	}
	
	localstore.unsaved = function() {
		db.transaction(function(tx) {
			tx.executeSql("SELECT fsaved FROM Forms WHERE fsaved != 'true';", [], function(tx, results) {
				document.getElementById("outbox-count").innerHTML = results.rows.length;
			});
		});
	}
	
	localstore.markFormAsSaved = function(formName, data) {
		db.transaction(function(tx) {
			tx.executeSql("UPDATE Forms SET fsaved='true' WHERE fKey=?;", [formName], function(tx, results) {
				try {
				// This line is where the id from the server can be set. Use data.inspectionid
				tx.executeSql("UPDATE Uploads SET inspectionId=? WHERE formKey=?;", [data.id, formName], function(tx, results) {
					console.log('updated uploads');
					tx.executeSql("SELECT * FROM Uploads WHERE formKey=? AND usaved != 'true';", [formName], function(tx, results) {
						for (var i=0; i<results.rows.length; i++) {
							try {
								sendFileToServer(results.rows.item(i), formName);
							} catch(e) {
								console.log(e);
							}
						}
					}, sqlError);
				});
				} catch(e) { console.log(e); spin.stop(); }
			}, logSql);
		});
		//util.prefetch('user'); This may need to be plugged in again, but may not be necessary with the new version of wq.
	}
	
	
	/* These functions are used to update the numbers in the outbox */
	localstore.allForms = function() {
		console.log('showing all forms');
		db.transaction(function(tx) {
			tx.executeSql("SELECT * FROM Forms", [], function(tx, results) {
				for (var i = 0; i < results.rows.length; i++) {
					console.log(results.rows.item(i));
				}
			});
		});
	}
	
	localstore.allUploads = function() {
		console.log('showing all uploads');
		db.transaction(function(tx) {
			tx.executeSql("SELECT * FROM Uploads", [], function(tx, results) {
				for (var i = 0; i < results.rows.length; i++) {
					console.log(results.rows.item(i));
				}
			});
		});
	}
	
/*******************/
/* FILE OPERATIONS */
/*******************/
	var elementInfo;
	localstore.captureImage = function(formId, gallery, source) {
		try {
		elementInfo = {
			formId: formId,
			gallery: gallery
		}
		var config = {
			quality: 50,
			destinationType: Camera.DestinationType.FILE_URI,
			encodingType: Camera.EncodingType.JPEG,
		};
		config.sourceType = source;
		navigator.camera.getPicture(cameraSuccess, cameraFail, config);
		} catch(e) {
			console.log('there was an error' + e);
		}
	}
	
	function cameraSuccess(imageData) {		
		elementInfo.fileURI = imageData;
		try {
			var image = document.createElement("IMG");
			image.src = imageData;
			image.style.display = "block";
			image.style.width = '200px';
			image.style.position = "relative";
			image.style.float = "left";
			image.style.padding = "10px";
			elementInfo.gallery.appendChild(image);
		} catch(e) { console.log(e); }
		saveFileToDb(elementInfo);
	}
	function cameraFail(message) {
		console.log('camera failed: ' + message);
	}
	
	saveFileToDb = function(elementInfo) {
		try {
			db.transaction(function(tx) {
				tx.executeSql("INSERT INTO Uploads (filename, formKey, inputName, usaved, editNew, projectid, servertable) VALUES (?, ?, ?, ?, ?, ?, ?);", [elementInfo.fileURI, elementInfo.formId, 'file[]', 'false', elementInfo.editNew, elementInfo.projectid, elementInfo.table], logSql); 
			});
		} catch(e) {
			console.log(e);
		}
	}
	
/*********************
 * SERVER OPERATIONS
 *********************/
function send_fail(errors) {
	console.log('error sending file: ' + errors);
	alert('The file attached failed to upload to the server. Please attach the photo from your camera roll and try again. This error may result from a weak internet connection.')
	setTimeout(spin.stop(), 2000);
	_render();
}

	sendFileToServer = function(fields, formName) {
		try {
			var params = {
				table: fields.servertable,
				projectid: fields.projectid,
				relatedid: fields.formKey.split('-')[2],
				formKey: fields.formKey,
				id: fields.inspectionId,
				action: fields.editNew
			}
			var fpos = fields.filename.split('/').length - 1;
			var url = encodeURI('https://ms4.ms4front.net/mobileapp.php'); 
			var options = new FileUploadOptions;
			options.params = params;
			options.fileKey = "file[]";
			options.httpMethod = "POST";
			options.fileName = fields.filename.split('/')[fpos];
			options.mimeType = "image/jpeg";
			console.log('file upload options');
			console.log(options);
			var ft = new FileTransfer();
			ft.upload(fields.filename, url, send_success, send_fail , options);
		} catch(e) {
			console.log('error uploading file: ' + e);
		}
	}
	function send_success(success) {
		var response = JSON.parse(success.response);
		var formKey = response.formKey;
		db.transaction(function(tx) {
			tx.executeSql("UPDATE Uploads SET usaved='true' WHERE formKey=?;", [formKey], function(tx, results) {
				console.log('updated uploads');
			})
		})
		spin.stop();
		//util.prefetch('user'); May need to plug util in again, but perhaps not.
		_render();
		
	}
	/* This is an unnecessary step 
	localstore.initializeForm = function(formId, label, editNew) {
		storeForm(formId, label, editNew);
	}
	*/
	sendOutboxToServer = function() {
		spin.start('Sending to Server');
		db.transaction(function(tx) {
			tx.executeSql("SELECT * FROM Forms WHERE fsaved != 'true';", [], function(tx, results) {
				if (results.rows.length == 0) {
					spin.stop();
					_render();
				}
				for (var i = 0; i < results.rows.length; i++) {
					var formId = results.rows.item(i).fkey;
					var fd = new FormData($(formId));
					fd.append('_', new Date().getTime());
					fd.fields = {};
					fd.method = "post";
					var res = JSON.parse(results.rows.item(i).fval);
					for (var j = 0; j < res.length; j++) {
						fd.append(res[j].name, res[j].value);
					}
					try {
						localstore.sendAllUnsaved(fd, formId);
					} catch(e) {
						console.log('not able to send unsaved');
					}
				}
			});
		});
	}

localstore.sendAllUnsaved = function(callback, frmId) {
	callback = setNull(callback);
	frmId = setNull(frmId);
	var url = ds.service;
	if (!callback) {
		sendOutboxToServer();	
	} else {
		$.ajax(url, {
			data: callback,
			type: "post",
			dataType: "json",
			contentType: false,
			processData: false,
			async: true,
			success: function(data) {
				localstore.markFormAsSaved(frmId, data);
				spin.stop();
				_render();
				return true;
			},
			error: function(e) {
				_render();
				return false;
			}
		});	
	}
}

localstore.deleteAll = function() {
	spin.start('Emptying Outbox');
	db.transaction(function(tx) {
		tx.executeSql("DELETE FROM Forms;");
	});
	db.transaction(function(tx) {
		tx.executeSql("DELETE FROM Uploads;");
	});
	db.transaction(function(tx) {
		tx.executeSql("DELETE FROM FormIds");
	})
	var reader = fs.root.createReader();
	reader.readEntries(function(fileList) {
		for (var i = 0; i < fileList.length; i++) {
			var ext = fileList[i].name.split('.').pop();
			if (ext != fileList[i].name) {
				deleteFileFromFileSystem(fileList[i].name);	
			}
		}
		spin.stop();
	}, function(error) {console.log(error); });
}

deleteFileFromFileSystem = function(fName) {
	fs.root.getFile(fName, {create: false, exlusive: false}, function(entry) {
		entry.remove(function(success) {
		}, function(error) {console.log(error);});
	}, function(error) {console.log(error);});
}

var all_files = [];

localstore.initializeDB();
return localstore;
});