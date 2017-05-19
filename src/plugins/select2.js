(function($axel) {

  const _Editor = (function() {

    /**
     * A jQuery plugin that adds a function to update the <option>s of a
     * Select2 field. Select2 4.0.3 still doesn't have a native function
     * for this : https://github.com/select2/select2/issues/2830
     */
    (function($) {
      $.fn.select2RefreshData = function (data) {
        this.select2('data', data);

        // Update options
        const $select = $(this[0]);
        const options = data.map(function(item) {
          return '<option value="' + item.id + '">' + item.text + '</option>';
        });
        $select.html(options.join('')).change();
      };
    })(jQuery);

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

    /**
     * Converts each character in source to uppercase and
     * removes the diacritics.
     * @param source {string}
     * @returns {string}
     */
    function translate(source) {
      let cur, pos, res = ''; const
      from = 'ÀÁÂÃÄÅÒÓÔÕÕÖØÈÉÊËÇÐÌÍÎÏÙÚÛÜÑŠŸŽ',
        to = 'AAAAAAOOOOOOOEEEECDIIIIUUUUNSYZ';
      for (let i = 0; i < source.length; i++) {
        cur = source.charAt(i).toUpperCase();
        pos = from.indexOf(cur);
        res += (pos >= 0) ? to.charAt(pos) : cur;
      }
      return res;
    }
    // Note : might want to use the stripDiacritics function from S2, but it is private... http://stackoverflow.com/questions/35557486/select2-custom-matcher-but-keep-stripdiacritics

    /**
     * This is the function that frames the query term that matches the text into a
     * <span class='select2-match'> ... </span> so that it will be underlined by the CSS
     * @param text
     * @param qTerm
     * @param markup {Array}
     * @param escapeFunction
     * @param matchIndexInText
     */
    function markMatch(text, qTerm, markup, escapeFunction, matchIndexInText) {
      const tl = qTerm.length;
      markup.push(escapeFunction(text.substring(0, matchIndexInText)));
      markup.push("<span class='select2-match'>");
      markup.push(escapeFunction(text.substring(matchIndexInText, matchIndexInText + tl)));
      markup.push("</span>");
      markup.push(escapeFunction(text.substring(matchIndexInText + tl, text.length)));
    }

    /**
     * The function that gets called by Select2 for customising how the
     * selected options are displayed in the form field (templateSelection S2 param)
     * @param itemState - an object containing state information about the selected option
     * @param container - the container of the option
     * @returns {string|*} - may return HTML, but keep in mind the escape (https://github.com/select2/select2/issues/3423)
     */
    function formatSelection(itemState, container) {
      const text = itemState.text;
      // the '::' check is for the complement option
      const i = text.indexOf('::');
      return (i !== -1) ? text.substr(0, i) : text;
    }

    function formatResultN(result, container, cOpenTag) {

      /* If result.loading, we are not receiving actual results yet, but just
       * "Searching…" or its localised variant. In that case or if there is no
       * query at all because there is no search, but a fixed list of options,
       * immediately return the text.
       * Keep in my mind that formatResult is always called to format each
       * option that is to be displayed in the list, but that when displaying
       * the options from a dropdown list with no search box, we don't want to
       * do anything to the option text. It is only when there is a query that we
       * want to underline the query term inside each result.
       */
      if (result.loading || !result.query) {
        return result.text;
      }

      const escapeMarkup = $.fn.select2.defaults.defaults.escapeMarkup;
      const resultText = result.text;
      const separatorIndex = resultText.indexOf('::');
      const cCloseTag = '</span>';
      const qTerm = translate(result.query);
      const qTermIndexInText = translate(resultText).indexOf(qTerm);
      let markup = [];

      if (separatorIndex !== -1) { // with the complement param, and if the current <option> actually contains a complement, since not every <option> has to (ex. 'Tessin::Bellinzone', but just 'Berne' in the demo !)
        if(qTermIndexInText < separatorIndex) { // match before '::'

        } else if (qTermIndexInText > separatorIndex + 1) { // match after '::'

        } else { // unusual case where '::' was searched ! (underline nothing)
          return escapeMarkup(resultText.substr(0, i)) + cOpenTag + escapeMarkup(resultText.substr(i + 2)) + cCloseTag;
        }
      } else { // without the complement param, or the current <option> text doesn't have a complement

      }
      return markup.join('');
    }

    /*
     * In v 3.4.0, the default formatResult function was :
     * formatResult: function(result, container, query, escapeMarkup) {
     *   var markup=[];
     *   markMatch(result.text, query.term, markup, escapeMarkup);
     *   return markup.join("");
     * },
     *
     * Now : only has two named params : result, container. The default templateResult is :
     * templateResult: function (result) {
     *   return result.text;
     * }
     * The templateResult function should return either HTML, which isn't escaped, or a string, which is escaped (any
     * HTML is stripped). Since the formatResult function from the select2 filter already returns a string, we still
     * return a string, but we change the escapeMarkup function (it's an S2 option) to just return its argument and
     * do nothing. Furthermore here, we declare it inside the function, since it's not passed anymore as an argument
     */
    // FIXME : this function should probably return HTML in the complement option case (so that the result will not be escaped and we can keep the default escapeMarkup function), but return a string in the other cases (so that if there are ampersands and other XML-invalid characters in the result text, it will get escaped by the default escapeMarkup). <- This comment is wrong, it is actually not possible to return a string, because we always want to underline the qTerm in the result text. Or return HTML in the underline case only ??? EN FAIT : non, ce n'est pas possible, parce qu'on ne renvoie pas qc qui commence et finit par un tag. Donc on peut pas convertir en HTML -> toujours renvoyer une string, et on doit escape chaque partie séparément; ça ne peut pas être simplifié. SAUF... si on encadre par un <span> ? (pourrait pertuber le CSS)

    /**
     * ATTENTION : il faut bien garder à l'esprit que cette fonction est TOUJOURS appelée
     * pour formater les résultats devant s'affiche dans la liste déroulante, MAIS lorsqu'il
     * n'y a pas de *recherche*, c'est-à-dire pas de query, on veut juste renvoyer le texte. Sinon, on veut souligner le qTerm dans le résultat !
     * @param result
     * @param container
     * @param openTag
     * @returns {*}
     */
    function formatResult(result, container, openTag) {
      const escapeMarkup = jQuery.fn.select2.defaults.defaults.escapeMarkup;
      /* if result.loading, we are not receiving actual results yet, but just "Searching…" or its localised variant
       * we should return immediately, as there is no query term.
       */
      if (result.loading || !result.query) {
        return escapeMarkup(result.text);
      }

      let text = (result && result.text) ? result.text : '', // useless, taken care of by the previous cond !
      i = text.indexOf('::'),
      oTag = openTag || ' - <span class="select2-complement">', // this || ... is actually useless !
      cTag = '</span>',
      qTerm = translate(result.query),
      match, markup;
      if (text) { // text ne peut jamais être vide ici !
        markup = [];
        if (i !== -1) { // with complement
          if (qTerm.length > 0) { // always true !
            match = translate(text).indexOf(qTerm);
            //match=$(result.element).data('key').indexOf(qTerm);
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
          } else { // never happens
            return escapeMarkup(text.substr(0, i)) + oTag + escapeMarkup(text.substr(i + 2)) + cTag;
          }
        } else if (qTerm.length > 0) { // w/o complement with term
          match = translate(text).indexOf(qTerm);
          //match=$(result.element).data('key').indexOf(qTerm);
          if (match >= 0) {
            markMatch(text, qTerm, markup, escapeMarkup, match);
          } else { // never happens
            return text;
          }
        } else { // never happens
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

    function inputTooShort(input) {
      const n = input.minimum - input.input.length;
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
        if (this.getParam('hasClass')) {
          // undocumented 'hasClass' param, probably for additional styling
          xtdom.addClassName(this.getHandle(), this.getParam('hasClass'));
        }
        const bMultiple = this.getParam('multiple') === 'yes';
        if (bMultiple) {
          this.getHandle().setAttribute('multiple', ''); // for boolean attributes, just use '' as value in setAttribute
        }

        /* Some info about the breaking changes between Select2 3.x and 4.x :
         * https://github.com/select2/select2/releases/tag/4.0.0-beta.1
         */
        const complementClass = this.getParam("complement");
        const tag = complementClass ? ' - <span class="' + complementClass + '">' : undefined;

        /* Define the templateResult function so that it receives an extra arg containing the
         * complement tag in case the plugin complement option is used.
         */
        const formRes = complementClass ? function (result, container) {
          return formatResult(result, container, tag);
        } : formatResult;

        const ph = this.getParam('placeholder');
        const select2Params = {
          templateSelection: formatSelection,
          templateResult: formRes,
          escapeMarkup: function (m) { return m; },
          language: {
            inputTooShort: inputTooShort,
            searching: function(params) {
              /* params is an Object {term: <chars entered in the field>, _type: "query"}, and is unused in the default
               * searching function. The only purpose of this function seems to internationalise the "Searching…" that
               * templateResult gets a few times before an actual result is returned.
               */
              return 'Recherche…';
            }
          },
          dropdownParent: $(this.getDocument().body), /* important in the case where
          the template is inside an iframe. */
          disabled: this.getParam('read-only') === 'yes'
        };


        let defaultVal = "";
        // Data source : either a data array (values and possibly i18n params), or ajax
        const ajaxUrl = this.getParam('ajax-url');
        if (ajaxUrl) {
          const ajax = {
            url: ajaxUrl,
            data: function (params) {
              return {
                q: params.term, // search term
                page: params.page
              };
            },
            processResults: function (data, params) {
              // parse the results into the format expected by Select2
              // since we are using custom formatting functions we do not need to
              // alter the remote JSON data, except to indicate that infinite
              // scrolling can be used
              params.page = params.page || 1;

              return {
                results: data.items,
                pagination: {
                  more: (params.page * 30) < data.total_count
                }
              };
            },
          };
          this._parseAjaxParamsAndExtend(ajax);
          select2Params.ajax = ajax;
        } else {
          /* instead of manually building the <option> elements, we
           * make an array that we use as the 'data' parameter for select2
           */
          /* Note : we shouldn't have to build the <option>s again if (aRepeater). But it seems that
           * if we use a placeholder, we are currently forced to build the array everytime, because of
           * the required empty entry at the beginning of the array (see comment below). Could use a cache.
           */
          select2Params.data = _buildDataArray(this.getParam('values'), this.getParam('i18n'));
          defaultVal = this.getDefaultData();
        }

        // FIXME : tags bug (incompatibility with AXEL ?). It is impossible to enter more than two characters for a new tag
        if (this.getParam('tags') === 'yes') {
          select2Params.tags = true;
          this.getHandle().setAttribute('multiple', ''); // make sure the select has its multiple attr,
          // otherwise 'tags' does nothing
        }
        /* Placeholders are only displayed as long as no value is selected; if a default value
         * was specified, it is useless to want to add a placeholder, as it will never be shown
         */
        if (ph && !defaultVal && !bMultiple) {
          // FIXME : it should be possible to use multiple at the same time as a placeholder, as this works fine in other examples. But it seems incompatible with AXEL, with the following issue : initially, the placeholder is not displayed, [[[and when selecting any option, an empty entry with just the close button in it is generated along with the selected option]]] <- no longer true, but why ? The placeholder is not displayed initially, but is once any numbers of options have been selected, and subsquently deselected, with the field left empty.
          // the placeholder option works only if there is an empty <option> in first position
          select2Params.data.unshift({id: "", text: ""});
          select2Params.placeholder = ph;
        }

        // parse other extra Select2 parameters
        this._parseExtraParamsAndExtend(select2Params);
        // TODO option not implemented : tokenSeparators

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
        const instance = this; // for use inside the change event handler, where 'this' is the select element
        this._$select.on('change', function (ev, data) {
          if (!(data && data.synthetic)) { // short circuit if onLoad ?
            instance.update($(this).val()); // update the model of the plugin instance (jQuery gives all the selected values in an array with .val(), whereas this.value without jQuery returns only the first value in the list that is selected.)
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

        // Request to leave focus (from tab navigation manager)
        unfocus: function () {
        },
      },

      /////////////////////////////
      // Specific plugin methods //
      /////////////////////////////
      methods: {

        _parseAjaxParamsAndExtend : function(oAjax) {
          const ajaxParams = {
            dataType: this.getParam('ajax-datatype'),
            delay: parseInt(this.getParam('ajax-delay'), 10) || 250,
            cache: this.getParam('ajax-cache') === 'yes' || true
          };
          Object.assign(oAjax, ajaxParams);
        },

        _parseExtraParamsAndExtend : function(params) {
          const paramTypes = { // S2 defaults on the right...
            dropdownAutoWidth : 'bool', // false
            closeOnSelect : 'bool', // true
            selectOnClose: 'bool', // false
            minimumInputLength: 'int', // 0
            maximumInputLength: 'int', // 0
            maximumSelectionLength: 'int', // 0
            minimumResultsForSearch: 'int', // 0
            width : 'str' /* 'resolve'. But S2 does also accept an int here. It is not necessary to
            parse it as an int, however, as it works fine with S2 even as a string without unit,
            in which the case the unit is assumed to be px. */
          };
          const extraParams = {};

          Object.keys(paramTypes).map(function(paramName) {
            const inputParamVal = this.getParam(paramName);
            const type = paramTypes[paramName];
            if (inputParamVal) {
              if (type === 'bool') {
                if (inputParamVal === 'true') {
                  extraParams[paramName] = true;
                } else {
                  extraParams[paramName] = false;
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
          const instance = this; // because inside timeout, 'this' is 'window'
          setTimeout(function() { instance._$select.focus(); }, 50);
          // keeps focus to be able to continue tabbing after drop list closing
        },

        clear : function (doPropagate) {
          this._setData(this.getDefaultData());
          if (this.isOptional()) {
            this.unset(doPropagate);
          }
        },

        /**
         * Dynamically updates the <option>s list. This method is called by the
         * ajax binding.
         * @param config = {items: [{label:, value:}, ...], restore: bool}
         * We need to change the names of the keys of the items array so that
         * they correspond to the format expected by Select2 :
         * value -> id and label -> text
         */
        ajax : function (config) {
          const items = config.items.map(item => {
            return { id: item.value, text: item.label }
          });
          this._$select.select2RefreshData(items);
          // (remove it if placeholder or set it to first option otherwise)
          if (config.restore) {
            this._setData(this._data);
          } else {
            this.clear(false);
          }
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
