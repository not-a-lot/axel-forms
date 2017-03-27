(function($axel) {

  let _Editor = (function() {

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

    const decodeTypes = {
      dropdownAutoWidth : 'bool',
      minimumResultsForSearch : 'int',
      closeOnSelect : 'bool',
      width : 'str',
      maximumSelectionSize : 'int',
      minimumInputLength : 'int'
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
          xtdom.addClassName(this._handle, this.getParam('hasClass'));
        }
        if (this.getParam('multiple') === 'yes') {
          this._handle.setAttribute("multiple", "");
        }
        // builds options if not cloned from a repeater
        if (!aRepeater) {
          /* instead of manually building the <option> elements, we
           * make an array that we use as the 'data' parameter for select2
           */
          const optionData = _buildDataArray(this.getParam('values'), this.getParam('i18n'));
          const defaultVal = this.getDefaultData();
          const ph = this.getParam('placeholder');
          const select2Params = {
            data: optionData,
            dropdownParent: $(this.getDocument().body), /* important in the case where
           the template is inside an iframe. */
          };
          /* Placeholders are only displayed as long as no value is selected ; if a default value
           * was specified, it is useless to want to add a placeholder, as it will never be shown
           */
          if (ph && !defaultVal) {
            // oddly, the placeholder option works only if there is an empty option in first position
            select2Params.data.unshift({id: "", text: ""});
            select2Params.placeholder = ph;
          }
          const $select = $(this._handle).select2(select2Params);
          // set the default selected value, if present in the params
          /* currently, there is no way to specify a default value in the select2 options. It has
           * to be done either in the HTML, or by setting the value after the object has been constructed
           */
          if (defaultVal) {
            $select.val(defaultVal).trigger('change');
          }
        }
      },

      // Awakes the editor to DOM's events, registering the callbacks for them
      onAwake: function () {
        // window.setTimeout(function() {
        //   $('select.axel-choice').select2(select2Params);
        // }, 5000);
        // let _this = this,
        //   defVal = this.getDefaultData(),
        //   pl = this.getParam("placeholder"),
        //   complementClass = this.getParam("complement"),
        //   tag = complementClass ? ' - <span class="' + complementClass + '">' : undefined,
        //   formRes = complementClass ? function (s, c, q, e) {
        //     return formatResult(s, c, q, e, tag);
        //   } : formatResult,
        //   params = {
        //     myDoc: this.getDocument(),
        //     formatResult: formRes,
        //     formatSelection: formatSelection,
        //     matcher: accentProofMatcher,
        //     formatInputTooShort: formatInputTooShort
        //   }, k, curVal, typVal;
        // for (k in decodeTypes) { // FIXME: typing system to be integrated with AXEL
        //   curVal = this.getParam('select2_' + k);
        //   if (curVal) {
        //     if (decodeTypes[k] === 'bool') {
        //       typVal = curVal;
        //     } else if (decodeTypes[k] === 'int') {
        //       typVal = parseInt(curVal, 10);
        //     } else {
        //       typVal = curVal;
        //     }
        //     params[k] = typVal;
        //   }
        // }
        // if (this.getParam("select2_tags") === 'yes') { // not compatible with placeholder. <- This seems no longer true!
        //   params.multiple = false;
        //   params.tags = this.getParam('i18n');
        //   delete params.minimumResultsForSearch;
        // } else {
        //   if (pl || (!defVal)) {
        //     pl = pl || "";
        //     // inserts placeholder option
        //     if (this.getParam('multiple') !== 'yes') {
        //       $(this._handle).prepend('<option></option>');
        //     }
        //     // creates default selection
        //     if (!defVal) {
        //       this._param.values.splice(0, 0, pl);
        //       if (this._param.i18n !== this._param.values) { // FIXME: check that this is correct
        //         this._param.i18n.splice(0, 0, pl);
        //       }
        //     }
        //     params.allowClear = true;
        //     params.placeholder = pl;
        //   }
        //   if (this.getParam('multiple') !== 'yes') {
        //     if (this.getParam('typeahead') !== 'yes') {
        //       params.minimumResultsForSearch = -1; // no search box
        //     }
        //   }
        // }
        // this._setData(defVal);
        // $(this._handle).select2(params).change(
        //   function (ev, data) {
        //     if (!(data && data.synthetic)) { // short circuit if forged event (onLoad)
        //       _this.update($(this).val()); // tells 'choice' instance to update its model
        //     }
        //   }
        // );
        // $(this._handle).prev('.select2-container').get(0).xttNoShallowClone = true; // prevent cloning
      },

      onLoad: function (aPoint, aDataSrc) {
      },

      onSave: function (aLogger) {
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
      methods: {}
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
