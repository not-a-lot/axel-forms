/*****************************************************************************\
|                                                                             |
|  'transform' command object                                                 |
|                                                                             |
|  Replaces host content by result of transformation of a template.           |
|  This is NOT an interactive command: it does not subscribe to user event.   |
|                                                                             |
|*****************************************************************************|
|  Command is executed :                                                      |
|  - by AXEL-FORMS document load handler to transform any host element with   |
|    data-template but w/o data-command="transform" (implicit creation)       |
|  - by calling the transform() method if it has been created as a result     |
|    of a data-command="transform" declaration                                |
|                                                                             |
|  Required attributes                                                        |
|  - data-template : sets the URL for the template to transform               |
|                                                                             |
|  Optional attributes                                                        |
|  - data-src                                                                 |
|  - data-transaction                                                         |
|  - data-cancel                                                              |
|                                                                             |
\*****************************************************************************/

(function () {

  function TransformCommand ( identifier, node, doc ) {
    var spec = $(node);
    this.doc = doc;
    this.key = identifier;
    this.spec = spec;
    if (spec.attr('data-command') !== 'transform') { // implicit command (data-template alone)
      xtiger.cross.log('debug','Transforming ' + identifier + ' in implicit mode');
      this.transform();
      this.implicit = true;
    } else {
      xtiger.cross.log('debug','Transforming ' + identifier + ' in explicit mode');
      this.implicit = false;
    }
    this.defaultTpl = this.spec.attr('data-template');
    this.defaultData = this.spec.attr('data-src') || '';
    this.ready = false;
  }

  TransformCommand.prototype = {

    attr : function (name) {
      if (arguments.length >1) {
        return this.spec.attr(name, arguments[1]);
      } else {
        return this.spec.attr(name);
      }
    },

    transform : function (tOptUrl, dOptUrl) {
      var name, set, config,
          templateUrl = tOptUrl || this.spec.attr('data-template'), // late binding
          dataUrl = dOptUrl || this.spec.attr('data-src'); // late binding
      xtiger.cross.log('debug', 'transforming physical editor ' + this.key);
      if ((templateUrl === this.spec.attr('data-template')) && this.ready) {
        this.reset();
      } else {
        if (templateUrl) {
          // 1. adds a class named after the template on 'body' element
          // FIXME: could be added to the div domContainer instead ?
          if (templateUrl !== '#') {
            name = templateUrl.substring(templateUrl.lastIndexOf('/') + 1);
            if (name.indexOf('?') !== -1) {
              name = name.substring(0, name.indexOf('?'));
            }
          }

          // 2. loads and transforms template and optionnal data
          config = {
            bundlesPath : $axel.command.defaults.bundlesPath,
            enableTabGroupNavigation : true
          };
          set = (templateUrl === '#') ? $axel(this.spec).transform(config) : $axel(this.spec).transform(templateUrl, config);

          if (dataUrl) {
            set.load(dataUrl);
            this.spec.attr('data-src', dataUrl);
          }

          // 3. registers optional unload callback if transactionnal style
          if (this.spec.attr('data-cancel')) {
            $(window).bind('unload', $.proxy(this, 'reportCancel'));
            // FIXME: works only if self-transformed and called ONCE !
          }

          // 4. triggers completion event
          if (set.transformed()) {
            if (! this.implicit) {
              xtiger.cross.log('debug', '[[[ installing bindings from "transform" command');
              $axel.binding.install(this.doc, this.spec.get(0), this.spec.get(0));
              xtiger.cross.log('debug', ']]] installed bindings from "transform" command');
              xtiger.cross.log('debug', '<<< installing commands from "transform" command');
              $axel.command.install(this.doc, this.spec.get(0).firstChild, this.spec.get(0).lastChild);
              xtiger.cross.log('debug', '>>> installed commands from "transform" command');
            }
            this.spec.attr('data-template', templateUrl);
            this.spec.addClass('edition').addClass(name); // FIXME: remove .xhtml
            this.ready = true;
          } else {
            this.ready = false;
          }
        } else {
          $axel.error('Missing data-template attribute to generate the editor "' + this.key + '"');
        }
      }
    },

    // Remove all data from the editor
    // If hard is true and the command was holding a data-template, restores it
    // FIXME: replace by $axel(this.spec).reset() with builtin reset algorithm
    reset : function (hard) {
      if (hard && this.defaultTpl && (this.defaultTpl !== this.spec.attr('data-template'))) { // last test to avoid loop
        this.attr('data-src', this.defaultData);
        this.transform(this.defaultTpl);
      } else {
        $axel(this.spec).load('<Reset/>'); // trick
        $('*[class*="af-invalid"]', this.spec.get(0)).removeClass('af-invalid');
        $('*[class*="af-required"]', this.spec.get(0)).removeClass('af-required');
      }
    },

    // Triggers an event
    trigger : function (name, source) {
      this.spec.triggerHandler(name, [this, source]);
    },

    // DEPRECATED : use $axel(~data-target~).xml() instead
    serializeData : function () {
      return $axel(this.spec).xml();
    },

    reportCancel : function (event) {
      if (! this.hasBeenSaved) { // trick to avoid cancelling a transaction that has been saved
        $.ajax({
          url : this.spec.attr('data-cancel'),
          data : { transaction : this.spec.attr('data-transaction') },
          type : 'GET',
          async : false
          });
      }
    }
  };

  $axel.command.register('transform', TransformCommand, { check : false });
}());