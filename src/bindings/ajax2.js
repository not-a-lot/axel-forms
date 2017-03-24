/*****************************************************************************\
|                                                                             |
|  AXEL 'ajax2' binding                                                        |
|                                                                             |
|  Implements data-ajax-trigger={variable} to dynamically load a 'choice'     |
|  list of options depending on the master host field value                   |
|                                                                             |
|*****************************************************************************|
|  Prerequisites: jQuery, AXEL, AXEL-FORMS                                    |
|                                                                             |
\*****************************************************************************/
(function($axel) {

  var _Ajax2 = {

    /* Executed on the creation of the binding
     * @param host : jQuery object wrapping the host element of the binding
     */
    onInstall : function(host) {
      // 'this' is a jQuery object too (_installBinding in binding.js)
      var cache, container;
      this.spec = host;
      this.editor = $axel(host);
      cache = this.spec.attr('data-ajax-cache');
      this.cache = cache ? JSON.parse(cache) : {}; // TODO: validate cache
      this.scope = this.spec.attr('data-ajax-scope');
      host.bind('axel-update', $.proxy(this.execute, this)); // proxy type (function, context)
      container = this.spec.attr('data-ajax-container');
      if (container) {
        this.spec.closest(container).bind('axel-content-ready', $.proxy(this, 'synchronize')); // proxy type (context, name)
      } else {
        $(document).bind('axel-content-ready', $.proxy(this, 'synchronize'));
      }
      if (this.scope) {
        this.spec.closest(this.scope).bind('axel-add', $.proxy(this, 'add'));
      }
    },

    methods : {

       // returns the element which has the data-ajax-trigger attribute, and which contains the target field
      wrapper : function() {
        var sel = '[data-ajax-trigger*="' + this.getVariable() + '"]';
        if (this.scope) { // mandatory in case of repeated master/target fields
          return this.spec.closest(this.scope).find(sel);
        } else {
          return $('body ' + sel, this.getDocument());
        }
      },

      saveSuccessCb : function (restoreFlag, response, status, xhr) {
        if (response.cache) {
          this.cache[response.cache] = response.items;  
        }
        this.load(restoreFlag, response.items);
      },

      saveErrorCb : function (xhr, status, e) {
        var msg = $axel.oppidum.parseError(xhr, status, e);
        $axel.error(msg);
      },
      
      // loads the array of options into all dependent editors
      load : function(restoreFlag, options) {
        // TODO: scope CSS rule with data-ajax-container
        var set = this.wrapper();
        set.each(function(i, e) {
          $axel(e).get(0).ajax({ 'items' : options, restore : restoreFlag }); /* this 'ajax' method here
          is the one of in src/plugins/choice.js */
        });
        this.last = options // last, s'il n'existait pas déjà, est ajouté à l'objet jQuery 'this' (toujours le même,
        // contenant _defaults, _doc, _param, _variable)
      },

      // restoreFlag to keep the editor's content (after loading XML content)
      update : function ( restoreFlag ) {
        var val = this.editor.text(), // 'val' is the index of the selected field in the master select drop-down
            href = this.spec.attr('data-ajax-url');
        if (val === "") {
          this.load(false);
        } else if (this.cache[val]) {
          this.load(restoreFlag, this.cache[val]);
        } else if (href) {
          href = $axel.resolveUrl(href.replace('$_', val), this.spec.get(0));
          $.ajax({
            url : href,
            type : 'GET',
            async : false,
            dataType : 'json',
            cache : false,
            timeout : 25000,
            success : $.proxy(this, 'saveSuccessCb', restoreFlag), // restoreFlag passé comme arg à saveSuccessCb
            error : $.proxy(this, 'saveErrorCb')
            });
        }
      },

      execute : function  (ev, editor) { // when one of the master selects is modified
        this.update(false);
      },
      
      synchronize : function  () { // when loading data into the editor with the Input button
        this.update(true);
      },
      
      add : function ( ev, repeater ) { // lorsqu'on a coché une case à côté de contact person, ou cliqué sur "+"
        var set = this.wrapper();
        // eq : celui de jQuery
        // fonction get(0) ici : dans axel/src/core/wrapper.js, l. 355
        $axel(set.eq(ev.position)).get(0).ajax({ 'items' : this.last, restore : ev.position === 0  });
      }
    }
  };

  $axel.binding.register('ajax2', // _registerBinding in binding.js
    null, // no options
    null, // no parameters on host
    _Ajax2);

}($axel));
