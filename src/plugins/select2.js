(function($axel) {

  const _Editor = (function() {

    /** Splits string s on every space not preceded with a backslash "\ "
     * @param {String} s - The string to split
     * @returns {Array}
     */
    function _split(s) {
      if (s.indexOf("\\ ") === -1) {
        return s.split(' ');
      } else {
        const res = s.replace(/\\ /g, "&nbsp;");
        return xtiger.util.array_map(res.split(' '),
          function (e) { return e.replace(/&nbsp;/g, " "); }
        );
      }
    } // FIXME: move to xtiger.util

    function _buildDataArray(values, i18nValues) {
      let data = new Array(values.length);
      values.forEach(function(item, index) {
        data[index] = { id: item, text: i18nValues[index]};
      });
      return data;
    }

    function formatResult(state, container, query, escapeMarkup, openTag) {
      let text = (state && state.text) ? state.text : '',
      i = text.indexOf('::'),
      oTag = openTag || ' - <span class="select2-complement">',
      cTag = '</span>',
      qTerm = translate(query.term),
      match, markup;
      if (text) {
        markup=[];
        if (i !== -1 ) { // with complement
          if (query.term.length > 0) {
            match = translate(text).indexOf(qTerm);
            //match=$(state.element).data('key').indexOf(qTerm);
            if (match < i) {
              markMatch(text.substr(0, i), qTerm, markup, escapeMarkup, match);
              markup.push(oTag + escapeMarkup(text.substr(i + 2)) + cTag);
            } else if (match > i+1) {
              markup.push(text.substr(0, i));
              markup.push(oTag);
              markMatch(text.substr(i + 2), qTerm, markup, escapeMarkup, match-i-2);
              markup.push(cTag);
            } else {
              return escapeMarkup(text.substr(0, i)) + oTag + escapeMarkup(text.substr(i + 2)) + cTag;
            }
          } else {
            return escapeMarkup(text.substr(0, i)) + oTag + escapeMarkup(text.substr(i + 2)) + cTag;
          }
        } else if (query.term.length > 0) { // w/o complement with term
          match=translate(text).indexOf(qTerm);
          //match=$(state.element).data('key').indexOf(qTerm);
          if (match >= 0) {
            markMatch(text, qTerm, markup, escapeMarkup, match);
          } else {
            return text;
          }
        } else {
          return text;
        }
        return markup.join("");
      }
    }

    // compute if new state is significative (i.e. leads to some non empty XML output)
    // meaningful iff there is no default selection (i.e. there is a placeholder)
    function _calcChange (defval, model) {
      let res = true;
      if (! defval) {
        if (typeof model === "string") { // single
          res = model !== defval;
        } else { // multiple
          if (!model || ((model.length === 1) && !model[0])) {
            res = false;
          }
        }
      } else { // FIXME: assumes no multiple default values
        res = model !== defval;
      }
      return res;
    }

    function formatInputTooShort(input, min) {
      const n = min - input.length;
      return xtiger.util.getLocaleString('hintMinInputSize', { 'n' : n });
    }

    return {
      ////////////////////////
      // Life cycle methods //
      ////////////////////////

      /** The plugin must create the HTML output for one plugin
       * instance inside the aContainer <div>
       * @returns {HTMLSelectElement} The select element representing the
       * static view of the plugin instance, also called "handle"
       */
      onGenerate: function (aContainer, aXTUse, aDocument) {
        const viewNode = xtdom.createElement(aDocument, 'select');
        xtdom.addClassName(viewNode, 'axel-choice');
        aContainer.appendChild(viewNode);
        // trick to prevent cloning 'select2' shadow list when instantiated inside a repetition
        // the guard is needed to persist xttOpenLabel if planted on plugin
        $(viewNode).wrap('<span class="axel-guard"/>');
        return viewNode;
      },

      onInit: function (aDefaultData, anOptionAttr, aRepeater) {
        const values = this.getParam('values');
        if (this.getParam('hasClass')) {
          // undocumented 'hasClass' param, probably for additional styling
          xtdom.addClassName(this.getHandle(), this.getParam('hasClass'));
        }
        if (this.getParam('multiple') === 'yes') {
          this.getHandle().setAttribute('multiple', ''); // for boolean attributes, just use '' as value in setAttribute
        }

        /* instead of manually building the <option> elements, we
         * make an array that we use as the 'data' parameter for select2
         */
        /* Note : we shouldn't have to build the <option>s again if (aRepeater). But it seems that
         * if we use a placeholder, we are currently forced to build the array everytime, because of
         * the required empty entry at the beginning of the array (see comment below). Could use a cache.
         */
        const optionData = _buildDataArray(this.getParam('values'), this.getParam('i18n'));
        const defaultVal = this.getDefaultData();
        // FIXME : issue with empty entry with just a close button when multiple and placeholder at the same time. Yet, this works fine in another separate example...

        /* Several options have changed names or work
         * differently than in Select2 3.x :
         * https://github.com/select2/select2/releases/tag/4.0.0-beta.1
         *
         * formatSelection -> templateSelection
         * formatResult -> templateResul
         *
         * internationalisation :
         * formatInputTooShort -> language.inputTooShort
         * ...
         */
        const complementClass = this.getParam("complement");
        const tag = complementClass ? ' - <span class="' + complementClass + '">' : undefined;
        const formRes = complementClass ? function (s, c, q, e) {
          return formatResult(s, c, q, e, tag);
        } : formatResult;

        const ph = this.getParam('placeholder');
        const select2Params = {
          data: optionData,
          dropdownParent: $(this.getDocument().body), /* important in the case where
          the template is inside an iframe. */
        };

        if (this.getParam('tags') === 'yes') {
          select2Params.tags = true;
          this.getHandle().setAttribute('multiple', ''); // make sure the select has its multiple attr,
          // otherwise 'tags' does nothing
        }
        /* Placeholders are only displayed as long as no value is selected; if a default value
         * was specified, it is useless to want to add a placeholder, as it will never be shown
         */
        if (ph && !defaultVal) {
          // the placeholder option works only if there is an empty <option> in first position
          select2Params.data.unshift({id: "", text: ""});
          select2Params.placeholder = ph;
        }

        // parse other extra Select2 parameters
        this._parseExtraParamsAndExtend(select2Params);
        // TODO missing options : disabled, tokenSeparators

        // call the Select2 library
        const $select = $(this.getHandle()).select2(select2Params);
        // set the default selected value, if present in the params
        /* currently, there is no way to specify a default value in the select2 options. It has
         * to be done either in the HTML, or by setting the value after the object has been constructed
         */
        if (defaultVal) {
          $select.val(defaultVal).trigger('change');
        }
        // set the default value of the model, even if it is empty
        this._setData(defaultVal);

        $select[0].nextSibling.xttNoShallowClone = true; /* we need to tell the repeater not to clone the
         span.select2-container element generated by Select2, which is next to the <select> handle */
        this._$select = $select;
      },

      // The clone of the model made by an xt:repeat does not keep event listeners, need to add them each time
      onAwake: function () {
        this._$select.on('change', function (ev, data) {
          if (!(data && data.synthetic)) { // short circuit if onLoad ?
            this.update(this.value); // update the model of the plugin instance
          }
        });
      },

      onLoad: function (aPoint, aDataSrc) {
        let value, defval, option, xval,tmp;
        if (aDataSrc.isEmpty(aPoint)) {
          this.clear(false);
        } else {
          xval = this.getParam('xvalue');
          defval = this.getDefaultData();
          if (xval) { // custom label
            value = [];
            option = aDataSrc.getVectorFor(xval, aPoint);
            while (option !== -1) {
              tmp = aDataSrc.getDataFor(option);
              if (tmp) {
                value.push(tmp);
              }
              option = aDataSrc.getVectorFor(xval, aPoint);
            }
            this._setData(value.length > 0 ? value : ""); // "string" and ["string"] are treated as equals by jQuery's val()
          } else { // comma separated list
            tmp = aDataSrc.getDataFor(aPoint);
            if (typeof tmp !== 'string') {
              tmp = '';
            }
            value = (tmp || defval).split(",");
            this._setData(value);
          }
          this.set(false);
          this.setModified(_calcChange(defval,value));
        }

        this._$select.trigger("change", { synthetic : true });
      },

      onSave: function (aLogger) {
        if ((!this.isOptional()) || this.isSet()) {
          if (this._data && (this._data !== this.getParam('placeholder'))) {
            const tag = this.getParam('xvalue');
            if (tag) {
              if (typeof this._data === "string") {
                aLogger.openTag(tag);
                aLogger.write(this._data);
                aLogger.closeTag(tag);
              } else {
                for (let i = 0; i < this._data.length; i++) {
                  if (this._data[i] !== "") { // avoid empty default (i.e. placeholder)
                    aLogger.openTag(tag);
                    aLogger.write(this._data[i]);
                    aLogger.closeTag(tag);
                  }
                }
              }
            } else {
              aLogger.write(this._data.toString().replace(/^,/,''));
            }
          }
        } else {
          aLogger.discardNodeIfEmpty();
        }
      },

      ////////////////////////////////
      // Overwritten plugin methods //
      ////////////////////////////////
      api: {

        //
        /**
         * We overwrite this method to parse the XTiger node,
         * in particular because we need to read the 'values' attribute
         * @param {object} aXTNode - The XTiger node, either xt:use or
         * xt:attribute
         * */
        _parseFromTemplate: function (aXTNode) {
          this._param = {};
          // put the key=value pairs from the param attribute into this._param
          xtiger.util.decodeParameters(aXTNode.getAttribute('param'), this._param);
          const defval = xtdom.extractDefaultContentXT(aXTNode); // value space (not i18n space)
          const optionAttr = aXTNode.getAttribute('option');
          this._option = optionAttr ? optionAttr.toLowerCase() : null;
          // read the values of the drop-down list
          const values = aXTNode.getAttribute('values'),
            i18n = aXTNode.getAttribute('i18n'),
            _values = values ? _split(values) : [],
            _i18n = i18n ? _split(i18n) : undefined;
          this._param.values = _values; // FIXME: should check that values and i18n are of same length
          this._param.i18n = _i18n || _values;
          this._content = defval || "";
        },

        isFocusable: function () {
          return true;
        },

        // Request to take focus (from tab navigation manager)
        focus: function () {
        },

        // Request to leave focus (fro tab navigation manager)
        unfocus: function () {
        },
      },

      /////////////////////////////
      // Specific plugin methods //
      /////////////////////////////
      methods: {

        _parseExtraParamsAndExtend : function(params) {
          const paramTypes = { // S2 defaults on the right...
            dropdownAutoWidth : 'bool', // false
            closeOnSelect : 'bool', // false
            selectOnClose: 'bool', // false
            minimumInputLength: 'int', // 0
            maximumInputLength: 'int', // 0
            maximumSelectionLength: 'int', // 0
            minimumResultsForSearch: 'int', // 0
            width : 'str' /* 'resolve'. But S2 does also accept an int here. It is not nessary to
            parse it as an int, however, as it works fine with S2 even as a string without unit,
            in which the case the unit is assumed to be px. */
          };
          const extraParams = {};

          Object.keys(paramTypes).map(function(paramName) {
            const inputParamVal = this.getParam(paramName);
            const type = paramTypes[paramName];
            if (inputParamVal) {
              if (type === 'bool') {
                // if anything other than 'true' was written in the template,
                // do nothing (default values are false anyhow)
                if (inputParamVal === 'true') {
                  extraParams[paramName] = true;
                }
              } else if (type === 'int') {
                extraParams[paramName] = parseInt(inputParamVal, 10);
              } else {
                extraParams[paramName] = inputParamVal;
              }
            }
          }, this); /* the 'this' on this line is the second arg to map,
          the object to use as 'this' inside the callback function. */
          Object.assign(params, extraParams); // copy the own properties of extraParams to params
        },

        _setData : function (value, withoutSideEffect) {
          let filtered = value;
          if (this.getParam("tags")) { // remove complement (see formatSelection)
            if (value.indexOf('::') !== -1) {
              filtered = value.substr(0, i);
            }
          }

          if(!filtered && (this.getParam('placeholder'))) {
            $(this.getHandle()).addClass("axel-choice-placeholder");
          } else {
            $(this.getHandle()).removeClass("axel-choice-placeholder");
          }

          this._data =  filtered || "";
          if (!withoutSideEffect) {
            $(this.getHandle()).val(filtered);
          }
        },

        update : function (aData) {
          const meaningful = _calcChange(this.getDefaultData(), aData);
          this.setModified(meaningful);
          this._setData(aData, true);
          this.set(meaningful);
          setTimeout(function() { this._$select.focus(); }, 50);
          // keeps focus to be able to continue tabbing after drop list closing
        }

      }
    };
  }());

  $axel.plugin.register(
    'select2',
    { filterable: true, optional: true },
    {}, // default key-value pairs for the param attribute in the XTiger node (_DEFAULTS in axel/src/core/plugin.js)
    _Editor
  );

  $axel.filter.applyTo({'event' : 'select2'});

}($axel));
