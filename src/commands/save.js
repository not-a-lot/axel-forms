/*****************************************************************************\
|                                                                             |
|  'save' command object (XML submission with Ajax a form)                    |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|  Required attributes :                                                      |
|  - data-target : id of the editor's container                               |
|                                                                             |
|  Optional attributes :                                                      |
|  - data-replace-type : defines what to do with the servers's response       |
|  - data-event-target : when data-replace-type is 'event' this attribute     |
|    gives the name of a second editor from which to trigger a copy cat of    |
|    'axel-save-done' event                                                   |
|  - data-validation-output (on the target editor): identifier of a target    |
|    element to use as a container for showing validation error messages,     |
|    the presence of this attribute causes validation                         |
|                                                                             |
\*****************************************************************************/

// TODO
// - customize server error decoding for Orbeon 3.8, eXist-DB, etc.

(function () {

  function SaveCommand ( identifier, node, doc ) {
    this.doc = doc || document;
    this.spec = $(node);
    this.key = identifier;
    this.spec.bind('click', $.proxy(this, 'execute'));
  }

  SaveCommand.prototype = (function () {

    function isResponseAnOppidumError (xhr ) {
      return $('error > message', xhr.responseXML).size() > 0;
    }

    function getOppidumErrorMsg (xhr ) {
      var text = $('error > message', xhr.responseXML).text();
      return text || xhr.status;
    }
    
    function unmarshalMessage( xhr ) {
      var text = $('success > message', xhr.responseXML).text();
      return text;
    }
    
    function unmarshalPayload( xhr ) {
      var start = xhr.responseText.indexOf('<payload>'),
          end,
          res = xhr.responseText;
      if (start != -1) {
        end = xhr.responseText.indexOf('</payload>');
        if (end != -1) {
          res = xhr.responseText.substr(start + 9, end - start - 9) ;
        }
      }
      return res;
    }

    function doSwap () {
      this.swap.remove();
      this.fragment.show();
    }

    function doReset () {
      var editor = $axel.command.getEditor(this.key);
      if (editor) {
        editor.reset();
        this.swap.remove();
        this.fragment.show();
      } else {
        $axel.error('Cannot find the document editor to reset', this.errTarget);
      }
    }

    // Tries to extract more info from a server error. Returns a basic error message
    // if it fails, otherwise returns an improved message
    // Compatible with eXist 1.4.x server error format
    function getExistErrorMsg (xhr) {
      var text = xhr.responseText, status = xhr.status;
      var msg = 'Error ! Result code : ' + status;
      var details = "";
      var m = text.match('<title>(.*)</title>','m');
      if (m) {
        details = '\n' + m[1];
      }
      m = text.match('<h2>(.*)</h2>','m');
      if (m) {
        details = details + '\n' + m[1];
      } else if ($('div.message', xhr.responseXML).size() > 0) {
        details = details + '\n' + $('div.message', xhr.responseXML).get(0).textContent;
        if ($('div.description', xhr.responseXML).size() > 0) {
          details = details + '\n' + $('div.description', xhr.responseXML).get(0).textContent;
        }
      }
      return msg + details;
    }

    function saveSuccessCb (response, status, xhr) {
      var loc = xhr.getResponseHeader('Location'),
          type, fnode, msg, tmp;
      if ((xhr.status === 201) || (xhr.status === 200)) {
        if (loc) {
          window.location.href = loc;
        } else {
          msg = unmarshalMessage(xhr); // side effect message
          if (msg) {
            alert(msg); // FIXME: use a reporting function !!!
          }
          type = this.spec.attr('data-replace-type') || 'all';
          if (type === 'event') {
            // FIXME: adjust editor's trigger method to add arguments...
            // FIXME: pass xhr.responseXML.getElementsByTagName("payload")[0] instead of xhr ?
            $axel.command.getEditor(this.key).trigger('axel-save-done', this, xhr);
            tmp = this.spec.attr('data-event-target');
            if (tmp) {
              tmp = $axel.command.getEditor(tmp);
              if (tmp) {
                tmp.trigger('axel-save-done', this, xhr);
              }
            }
          } else {
            fnode = $('#' + this.spec.attr('data-replace-target'));
            if (fnode.length > 0) {
              if (type === 'all') {
                fnode.replaceWith(unmarshalPayload(xhr));
              } else if (type === 'swap') {
                this.swap = $(unmarshalPayload(xhr)); // FIXME: document context ?
                fnode.after(this.swap);
                fnode.hide();
                this.fragment = fnode; // cached to implement data-command="continue"
                $('button[data-command="continue"]', this.swap).bind('click', $.proxy(doSwap, this));
                $('button[data-command="reset"]', this.swap).bind('click', $.proxy(doReset, this));
              } else if (type === 'append') {
                fnode.append(unmarshalPayload(xhr));
              } // 'prepend', 'before', 'after'
              $axel.command.getEditor(this.key).trigger('axel-save-done', this, xhr);
            } else {
              xtiger.cross.log('error', 'missing "data-replace-target" attribute to report "save" command success');
            }
          }
        }
      } else {
        $axel.error('Unexpected response from server (' + xhr.status + '). Save action may have failed', this.errTarget);
      }
    }

    function saveErrorCb (xhr, status, e) {
      var s;
      if (status === 'timeout') {
        $axel.error("Save action taking too much time, it has been aborted, however it is possible that your page has been saved", this.errTarget);
      } else if (xhr.status === 409) { // 409 (Conflict)
        s = xhr.getResponseHeader('Location');
        if (s) {
          window.location.href = s;
        } else {
          $axel.error(getOppidumErrorMsg(xhr), this.errTarget);
        }
      } else if (isResponseAnOppidumError(xhr)) {
        // Oppidum may generate 500 Internal error, 400, 401, 404
        $axel.error(getOppidumErrorMsg(xhr), this.errTarget);
      } else if (xhr.responseText.search('Error</title>') !== -1) { // eXist-db error (empirical)
        $axel.error(getExistErrorMsg(xhr), this.errTarget);
      } else if (e) {
        $axel.error('Exception : ' + e.name + ' / ' + e.message + "\n" + ' (line ' + e.lineNumber + ')', this.errTarget);
      } else {
        $axel.error('Error while connecting to "' + this.url + '" (' + xhr.status + ')', this.errTarget);
      }
    }

    return {
      execute : function (event) {
        var editor = $axel.command.getEditor(this.key),
            valid = true, method, dataUrl, transaction, data, errtarget, fields,
            yesNo = this.spec.attr('data-save-confirm');
        if (editor) {
          if (!yesNo || confirm(yesNo)) {
            url = this.spec.attr('data-src') || editor.attr('data-src') || '.'; // last case to create a new page in a collection
            if (url) {
              if (editor.attr('data-validation-output') || this.spec.attr('data-validation-output')) {
                fields = $axel(editor.spec.get(0)); // FIXME: define editor.getRoot()
                valid = $axel.binding.validate(fields,
                  editor.attr('data-validation-output')  || this.spec.attr('data-validation-output'),
                  this.doc, editor.attr('data-validation-label')  || this.spec.attr('data-validation-label'));
              }
              if (valid) {
                data = editor.serializeData();
                if (data) {
                  method = editor.attr('data-method') || this.spec.attr('data-method') || 'post';
                  transaction = editor.attr('data-transaction') || this.spec.attr('data-transaction');
                  if (transaction) {
                    url = url + '?transaction=' + transaction;
                  }
                  $.ajax({
                    url : $axel.resolveUrl(url),
                    type : method,
                    data : data,
                    dataType : 'xml',
                    cache : false,
                    timeout : 50000,
                    contentType : "application/xml; charset=UTF-8",
                    success : $.proxy(saveSuccessCb, this),
                    error : $.proxy(saveErrorCb, this)
                    });
                    editor.hasBeenSaved = true; // trick to cancel the "cancel" transaction handler
                    // FIXME: shouldn't we disable the button while saving ?
                } else {
                  $axel.error('The editor did not generate any data');
                }
              }
            } else {
              $axel.error('The command does not know where to send the data');
            }
          }
        } else {
          $axel.error('There is no editor associated with this command');
        }
      }
    };
  }());

  $axel.command.register('save', SaveCommand, { check : false });
}());
