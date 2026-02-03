/*
    This is a NON minified version of Booster's Javascript
    This is NOT the default javascript being served
    By default BoosterTheme will load "booster.min.js" which can be found in /assets
    In order to minify this file and replace "booster.min.js" you can use ANY Javascript minifier as this code does NOT use Liquid
*/

function debounce(func, wait, immediate) {
    var timeout;
    return function () {
        var context = this,
            args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

function getRandomInt(minimum, maximum){
    return Math.floor(Math.random() * (maximum - minimum + 1) + minimum)
}

function closeModal(event, modal = false){
    if(!modal) modal = event.currentTarget.closest('[data-bstr-modal]') || event.currentTarget.closest('.modal')
    if(modal) modal.style.display = "none"
}

const isUndefined = (e)=>typeof e == "undefined"

Element.prototype.closestEl = function (e) {
	for (var t = this.parentElement; t;) {
		if (t.matches(e)) return t;
		var r = t.querySelectorAll(e);
		for (let i = 0, mi = r.length; i < mi; ++i)
			if (null != r[i] && r[i] != this) return r[i];
		t = t.parentElement
	}
	return null
};

const BstrDummyClass = new Proxy(new (class BstrEmptyClass{}), {
    get(target, name){
      return ()=>{}
    }
})

const __bstrInitClass = (cls, ...args) => {
    try{
        return new cls(...args)
    }catch(err){
        console.debug("[Booster Class Init] ", err)
    }
}

class BstrStore {
    constructor(){}

    get(key, def = false, parse = true){
        const value = localStorage.getItem(key);
        if(!value) return def
        if(!parse) return value

        try{
            const json = JSON.parse(value);
            if(typeof json.data == null || typeof json.exp == null || json.storeRef !== "bstr") return json

            if(json.exp && json.exp < Date.now()){
                localStorage.removeItem(key);
                return def;
            }

            return json.data;
        }catch(err){
            return def;
        }
    }

    set(key, value, exp = false){
        const expiration =  (exp && !isNaN(exp)) ? Date.now() + (exp * 60000) : false;
        const dataToStore = {data: value, storeRef: 'bstr', exp: expiration};

        localStorage.setItem(key, JSON.stringify(dataToStore));
        return true;
    }
}

class BstrAsync{
    constructor({events}){
        this.events = events
    }

    async load({url, section = false, selector = 'body', json = false}){
        if(section) url.searchParams.set('section_id', section)
        let r = await fetch(url.toString())
        if(!r.ok) return {}
        try{
            let raw = await r.text()
            let dom = new DOMParser().parseFromString(raw, 'text/html')
            if(!json) return {html: dom.querySelector(selector).innerHTML, parser: dom}
            try{
                return {html: dom.querySelector(selector).innerHTML, parser: dom, json: JSON.parse(dom.querySelector(json).innerText)}
            }catch(err){
                console.debug(err)
                return {html: dom.querySelector(selector).innerHTML, parser: dom, json: false}
            }       
        }catch(err){
            console.debug(err)
            return {}
        }
    }

    async getUpsell(product){
        let {html} = await this.load({url: new URL(window.location.origin + product), section: 'api__upsell', selector: '.shopify-section'})
        return html
    }
}

class BstrCart{
    constructor({events, basync}){
        this.events = events
        this.basync = basync
        this.queue = [];
        this.awaitingSuccess = [];
        this.listeners = [];
        this.minicart = {lastUpdate: 0};
        this.cartSuccessConfig = {action: _settings.cartAction};
        this.cartSuccessInfoTemplate = document.querySelector('.add-to-cart__success--single-current') && document.querySelector('.add-to-cart__success--single-current').innerHTML || false;
        let carts = document.querySelectorAll('[data-cart-container]');
        for(let i = 0, maxi = carts.length; i < maxi; ++i){
            this.addListener(carts[i]);
        }
        this.dispatchListeners();
        this.bindXHRFetch();
    }

    bindXHRFetch(){
        const self = this;
        const open = window.XMLHttpRequest.prototype.open;
        function openReplacement() {
                this.addEventListener("load", function (){
                        try{
                            let url = new URL(this._url);
                            if(url.origin == window.location.origin){
                                if([
                                    `${window.Shopify.routes.root}cart/add.js`,
                                    `${window.Shopify.routes.root}cart/update.js`,
                                    `${window.Shopify.routes.root}cart/change.js`,
                                    `${window.Shopify.routes.root}cart/clear.js`,
                                    `${window.Shopify.routes.root}cart/add`,
                                ].includes(url.pathname)){
                                    self.dispatchListeners({change: true});
                                }
                            }
                        }catch(err){
                            try{
                                if([
                                    `${window.Shopify.routes.root}cart/add.js`,
                                    `${window.Shopify.routes.root}cart/update.js`,
                                    `${window.Shopify.routes.root}cart/change.js`,
                                    `${window.Shopify.routes.root}cart/clear.js`,
                                    `${window.Shopify.routes.root}cart/add`,
                                ].includes(this._url)){
                                    self.dispatchListeners({change: true});
                                }
                            }catch(error){
                                console.log('[BOOSTER THEME] Invalid URL format caught in XHR.')
                            }
                        }
                    }
                );
            return open.apply(this, arguments);
        }
        window.XMLHttpRequest.prototype.open = openReplacement;

        (function(ns, fetch) {
            if (typeof fetch !== 'function') return;
            ns.fetch = function() {
                const response = fetch.apply(this, arguments);
                response.then(res => {
                    try{
                        let url = new URL(res.url);
                        if(url.origin == window.location.origin){
                            if([
                                `${window.Shopify.routes.root}cart/add.js`,
                                `${window.Shopify.routes.root}cart/update.js`,
                                `${window.Shopify.routes.root}cart/change.js`,
                                `${window.Shopify.routes.root}cart/clear.js`,
                                `${window.Shopify.routes.root}cart/add`,
                            ].includes(url.pathname)){
                                self.dispatchListeners({change: true});
                            }
                        }
                    }catch(err){
                        console.log('[BOOSTER THEME] Invalid URL format caught in fetch.')
                    }
                });
                return response;
            }
        }(window, window.fetch))

        window.addEventListener('storage', (e)=>{
            if(e.key != 'bstr:cart:update') return
            if(bstore.get('bstr:cart:update', 0) > self.minicart.lastUpdate){
                this.dispatchListeners()
            }
        })
    }

    open(){
        let checked = document.querySelectorAll('[data-minicart-input]:checked')
        if(checked.length) return
        let mi = document.querySelectorAll('[data-minicart-input]')
        for(let m of mi){
            let l = m.closestEl('.minicart__label')
            if(l && l.clientHeight > 0 && l.clientWidth > 0) return m.checked = true
        }
    }

    close(){
        let checked = document.querySelectorAll('[data-minicart-input]:checked')
        for(let c of checked){ c.checked = false }
    }

    async clear(){
        let r = await fetch(`${window.Shopify.routes.root}cart/clear.js`)
        if(!r.ok) return
        this.events.trigger('booster:cart:clear')
    }

    addListener(target, data){
        let settingsData = target.dataset.cartSettings.split(',');
        let settings = {};
        for(let i = 0, maxi = settingsData.length; i < maxi; ++i){
            let key = settingsData[i];
            settings[key] = target.querySelector(`[data-${key}]`);
        }
        this.listeners.push(
            {target: target, settings: settings}
        )
    }

    minicartHandler(time){
        for(let i = 0, maxi = this.listeners.length; i < maxi; ++i){
            let target = this.listeners[i];
            let keys = Object.keys(target.settings);
            for(let j = 0, maxj = keys.length; j < maxj; ++j){
                let key = keys[j];
                
                if(!target.settings[key]){
                    continue
                }
                if(target.settings[key].dataset.lastUpdate > time){
                    continue;
                }
                if(typeof events != "undefined" && events.indexOf(key) == -1){
                    continue;
                }

                switch(key){
                    case 'count':
                    target.settings[key].innerText = this.minicart.data.item_count;
                    break;
                    case 'product-list':
                    target.settings[key].innerHTML = this.minicart.data.html;
                    break;
                    case 'total':
                    target.settings[key].innerText = this.minicart.data.total;
                    break;
                }
                target.settings[key].dataset.lastUpdate = time;
            }
        }
    }

    async dispatchListeners({change = false} = {}){
        let self = this;
        let time = Date.now();

        if(time > self.minicart.lastUpdate){
            let cartData = await (await fetch(`${window.Shopify.routes.root}?section_id=api__minicart`, {headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Expires': 0 }})).text();
            let div = document.createElement('div')
            div.innerHTML = cartData
            this.minicart = {lastUpdate: time, data: JSON.parse(div.innerText)};
            this.minicart.data.items = JSON.parse(this.minicart.data.items);
            this.events.trigger('booster:cart:update', this.minicart, true)
        }

        this.minicartHandler(time);
        if(change) localStorage.setItem('bstr:cart:update', time)
        this.events.trigger('booster:content:update', {trigger: 'minicart'})

        while(this.awaitingSuccess.length){
            this.success(this.awaitingSuccess.pop());
        }
    }

    quantityHandler(event, incr, updateCart = true){
        event.preventDefault();
        let qtyInput = event.target.parentElement.querySelector('[data-qty-input]');
        let {target} = event;
        if(incr){
            if(!isNaN(parseInt(qtyInput.max)) && parseInt(qtyInput.value) >= qtyInput.max) return this.error({description: "Seems like there are no more items in stock."})
            qtyInput.value++;
        } else {
            if(parseInt(qtyInput.value) <= 0 || !updateCart && parseInt(qtyInput.value) == 1) return false
            if(parseInt(qtyInput.value) == 1 ){
                let mcentry = target ? target.closest('.minicart__entry') : false;
                let centry = target ? target.closest('.cart__item') : false;
                if(target) target.disabled = true;
                if(centry) centry.style.opacity = "0.5"
                if(mcentry) mcentry.style.opacity = "0.5"
            }
            --qtyInput.value;
        }
        if(!updateCart) return true
        return qtyInput.onchange({target: qtyInput});
    }

    stickyQuantityHandler(event, incr, updateCart = true){
        event.preventDefault();
        let prodId = event.target.dataset.productId;
        let form = document.querySelector(`#product_form_${prodId}`)
        let qtyInput = form ? form.querySelector('[data-qty-input]') : event.target.parentElement.querySelector('[data-qty-input]');
        let closestQtyInput = event.target.parentElement.querySelector('.quantity--input__input');
        let {target} = event;
        if(incr){
            if(!isNaN(parseInt(qtyInput.max)) && parseInt(qtyInput.value) >= qtyInput.max) return this.error({description: "Seems like there are no more items in stock."})
            qtyInput.value++;
            if (closestQtyInput) closestQtyInput.value++;
        } else {
            if(parseInt(qtyInput.value) <= 0 || !updateCart && parseInt(qtyInput.value) == 1) return false
            if(parseInt(qtyInput.value) == 1 ){
                let mcentry = target ? target.closest('.minicart__entry') : false;
                let centry = target ? target.closest('.cart__item') : false;
                if(target) target.disabled = true;
                if(centry) centry.style.opacity = "0.5"
                if(mcentry) mcentry.style.opacity = "0.5"
            }
            --qtyInput.value;
            if (closestQtyInput) --closestQtyInput.value;
        }
        if(!updateCart) return true
        return qtyInput.onchange({target: qtyInput});
    }

    addToQueue(data){
        this.queue.push(data)
        if(this.queue.length > 1) return
        this.checkQueue()
    }

    addToCartIU(){
        let selected = document.querySelectorAll('input.inline-upsell__toggle:checked');
        let data = {items: []}
        for(let i = 0, maxi = selected.length; i < maxi; ++i){
            let id = document.getElementById(selected[i].dataset.for).value;
            data.items.push({quantity: 1, id: id});
        }
        this.addToCartJSON(false, data)
    }

    addToCart(event = false, form = false){
        if(!event && !form) return
        let target = false;
        if(event){ target = event.currentTarget; event.preventDefault(); event.stopImmediatePropagation() }
        if(!form) form = target.closest('form')
        if(target){
            target.disabled = true
            target.querySelector('[data-button-text]').innerText = _bstrLocale.buttons.adding
        }
        let {prevent} = this.events.trigger('booster:cart:b*add', {form, target})
        if(prevent){
            if(target){
                target.disabled = false
                target.querySelector('[data-button-text]').innerText = target.dataset.originalText
            }
            return
        }
        this.addToQueue({form, target})
        closeModal(event);
    }

    addToCartJSON(event = false, json = {items: []}, isUpsell = false){
        let target = false;
        if(event) target = event.currentTarget
        if(target && !isUpsell){
            target.disabled = true
            target.querySelector('[data-button-text]').innerText = _bstrLocale.buttons.adding
        }
        let {prevent} = this.events.trigger('booster:cart:b*add', {json, target})
        if(prevent){
            if(target){
                target.disabled = false
                target.querySelector('[data-button-text]').innerText = target.dataset.originalText
            }
            return
        }

        if(target && isUpsell) {
            target.disabled = true
            let productId = json.items[0].product
            let variantDropDown = document.querySelector(`.minicart__variant-dropdown[data-product-id='${productId}']`)
            let variantQuantity = document.querySelector(`[data-cart-upsell-quantity-id="${productId}"]`);
            
            if(variantDropDown) {
                let variantId = variantDropDown.value;
                json.items[0].id = variantId
                json.items[0].quantity = variantQuantity.value
            }
           
            target.querySelector('[data-button-text]').style.display = 'none'
            target.querySelector('.upsellLoader').style.display = 'inline-block'
        }
        this.addToQueue({target, json})
    }

    async removeFromCart(target = false, id){
        let mentry = target ? target.closest('.minicart__entry') : false;
        if(target) target.disabled = true;
        if(mentry) mentry.style.opacity = "0.5"
        let res = await (await fetch(`${window.Shopify.routes.root}cart/change.js`, {method: 'POST', headers: {'Content-Type': 'application/json' }, body: JSON.stringify({quantity: 0, id: id})})).json();
        if(!isUndefined(res.status) && res.status != "success"){
            if(target) target.disabled = false
            if(mentry) mentry.style.opacity = "1"
            return this.error(res);
        }
        return true;
    }

    async updateQuantity(event, variant, quantity, forced = false){
        let {target} = event
        if(!forced){
            variant = target.dataset.variantId;
            quantity = target.value;
        }
        let res = await (await fetch(`${window.Shopify.routes.root}cart/change.js`, {method: 'POST', headers: {'Content-Type': 'application/json' }, body: JSON.stringify({quantity: quantity, id: variant})})).json();
        if(!isUndefined(res.status) && res.status != "success") return this.error(res)
    }

    async updateVariant(event, id){
        let {target} = event
        let qtyInput = event.target.parentElement.querySelector('[data-qty-input]');

        let mentry = target ? target.closest('.minicart__entry') : false;
        if(target) target.disabled = true;
        if(mentry) mentry.style.opacity = "0.5"
        document.querySelectorAll('.quantity--input__button').forEach(button => button.disabled = true);
        let res = await (await fetch(`${window.Shopify.routes.root}cart/change.js`, {method: 'POST', headers: {'Content-Type': 'application/json' }, body: JSON.stringify({quantity: 0, id: id})})).json();
        if(!isUndefined(res.status) && res.status != "success"){
            if(target) target.disabled = false
            if(mentry) mentry.style.opacity = "1"
            return this.error(res);
        }

        let formData = {
            'items': [{
             'id': target.value,
             'quantity': qtyInput.value
             }]
           };
           fetch(window.Shopify.routes.root + 'cart/add.js', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json'
             },
             body: JSON.stringify(formData)
           })
           .then(response => {
             return response.json();
           })
           .catch((error) => {
             console.error('Error:', error);
           });
        return true;
    }

    checkQueue(){
        if(this.queue.length){
            this.processQueue(this.queue.shift());
        }
    }

    async processQueue(data){
        let {target, form, json} = data
        let fconfig = form ? {method: 'POST', body: new URLSearchParams(new FormData(form)), headers: {'Content-Type': 'multipart/form-data'}} : {method: 'POST', body: JSON.stringify(json), headers: {'Content-Type': 'application/json'}}
        let res = await (await fetch(`${window.Shopify.routes.root}cart/add.js`, fconfig)).json();

        if(target){
            target.disabled = false
            target.querySelector('[data-button-text]').innerText = target.dataset.originalText
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
         'event': 'Add To Cart',
          'items' : [
            {
              'id': res.id,
              'name': res.title,
              'brand': res.vendor,
              'price' : res.price * 0.01,
              'variant' : res.variant_title
            }
          ]
         });

        typeof res.status != "undefined" && res.status != "success" ? this.error(res) : this.awaitingSuccess.push(res)

        this.checkQueue()
    }

    async renderModal(item, render_upsell = false){
        let prevent_modal = this.events.trigger('booster:cart:b*modal', {item, cart: this.minicart, will_upsell: render_upsell})
        if(prevent_modal.prevent) return
        let container = document.getElementById('checkout--success');
        let modal = container.closest('.modal');
        let image = item.image;
        let title = item.product_title;
        let variant = '';
        let total = this.minicart.data.total;
        let itemCountInt = this.minicart.data.item_count;
        let itemCount = itemCountInt + ' item' + (itemCountInt > 1 ? 's' : '');
        if(!item.product_has_only_default_variant) variant = item.variant_title;
        let productInfo = container.querySelector('.add-to-cart__success--single');
        const $pi = (q)=>productInfo.querySelector(q)
        let imgc = $pi('.add-to-cart__success--single-img');
        if(image != null){
            imgc.src = image
            imgc.style.display = "block"
        } else {
            imgc.style.display = "none"
        }
        $pi('.add-to-cart__success--single-title').innerText = title;
        $pi('.add-to-cart__success--single-variation').innerText = variant;
        let template = this.cartSuccessInfoTemplate.replace('%total%', ` <strong>${total}</strong>`).replace('%itemCount%', itemCount);
        $pi('.add-to-cart__success--single-current').innerHTML = template;
        let prevent_upsell = this.events.trigger('booster:cart:b*upsell', {item, cart: this.minicart})
        if(render_upsell && !prevent_upsell.prevent){
          let upsell = await this.basync.getUpsell(item.url);
          let upsellContainer = container.querySelector('.add-to-cart__success--upsell');
          upsellContainer.style.display = "none"
          if(upsell.trim() != ''){
              let modal = document.getElementById('quickbuy__modal')
              if(modal) modal.style.display = "none"
              upsellContainer.innerHTML = upsell
              upsellContainer.style.display = "block"
              this.events.trigger('booster:cart:upsell', {html: upsellContainer, items: false, item, cart: this.minicart})

              new Swiper('.add-to-cart__success--upsell .swiper', {
                slidesPerView: 1,
                spaceBetween: 20,
                grabCursor: true,
                allowTouchMove: true,
                loop: true,
                autoheight: true,
                navigation: {
                    nextEl: "[data-bstr-carousel-button-next]",
                    prevEl: "[data-bstr-carousel-button-prev]",
                },
                breakpoints: {
                    320: {
                        slidesPerView: 1,
                    },
                    768: {
                        slidesPerView: 2,
                    },
                    1024: {
                        slidesPerView: 3,
                    }
                    }
                });
          }
        }
        modal.style.display = "block";
        this.events.trigger('booster:content:update', {trigger: 'upsell'})
    }

    success(data){
        let config = this.cartSuccessConfig;
        let item = data.items && data.items[0] || data
        this.events.trigger('booster:cart:add', {item})
        if(config.action == 'cart') return window.location = `${window.Shopify.routes.root}cart`;
        if(config.action == 'checkout') return window.location = `${window.Shopify.routes.root}checkout`;
        if(config.action == 'message') return this.events.trigger('booster:notify', {type: 'success', message: 'Product added to cart successfully.'});
        if(config.action == 'minicart' && window.location.pathname != `/cart`) return this.open()
        if((config.action == 'upsell' || config.action == 'added') && window.location.pathname != `/cart`) this.renderModal(item, config.action == 'upsell')
      }

      error(data){
          console.error('Error trying to add product:\n', data)
          return this.events.trigger('booster:notify', {type: 'error', message: data})
      }
}

class BstrCurrency{
    constructor({events}){
        this.moneyFormats = { USD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} USD" }, EUR: { money_format: "&euro;{{amount}}", money_with_currency_format: "&euro;{{amount}} EUR" }, GBP: { money_format: "&pound;{{amount}}", money_with_currency_format: "&pound;{{amount}} GBP" }, CAD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} CAD" }, ALL: { money_format: "Lek {{amount}}", money_with_currency_format: "Lek {{amount}} ALL" }, DZD: { money_format: "DA {{amount}}", money_with_currency_format: "DA {{amount}} DZD" }, AFN: { money_format: "&#65;&#102; {{amount}}", money_with_currency_format: "&#65;&#102; {{amount}} AFN" }, AOA: { money_format: "Kz{{amount}}", money_with_currency_format: "Kz{{amount}} AOA" }, ARS: { money_format: "${{amount_with_comma_separator}}", money_with_currency_format: "${{amount_with_comma_separator}} ARS" }, AMD: { money_format: "{{amount}} AMD", money_with_currency_format: "{{amount}} AMD" }, AWG: { money_format: "Afl{{amount}}", money_with_currency_format: "Afl{{amount}} AWG" }, AUD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} AUD" }, BBD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} Bds" }, AZN: { money_format: "m.{{amount}}", money_with_currency_format: "m.{{amount}} AZN" }, BDT: { money_format: "Tk {{amount}}", money_with_currency_format: "Tk {{amount}} BDT" }, BSD: { money_format: "BS${{amount}}", money_with_currency_format: "BS${{amount}} BSD" }, BHD: { money_format: "{{amount}}0 BD", money_with_currency_format: "{{amount}}0 BHD" }, BYN: { money_format: "Br {{amount}}", money_with_currency_format: "Br {{amount}} BYN" }, BYR: { money_format: "Br {{amount}}", money_with_currency_format: "Br {{amount}} BYR" }, BZD: { money_format: "BZ${{amount}}", money_with_currency_format: "BZ${{amount}} BZD" }, BTN: { money_format: "Nu {{amount}}", money_with_currency_format: "Nu {{amount}} BTN" }, BAM: { money_format: "KM {{amount_with_comma_separator}}", money_with_currency_format: "KM {{amount_with_comma_separator}} BAM" }, BRL: { money_format: "R$ {{amount_with_comma_separator}}", money_with_currency_format: "R$ {{amount_with_comma_separator}} BRL" }, BOB: { money_format: "Bs{{amount_with_comma_separator}}", money_with_currency_format: "Bs{{amount_with_comma_separator}} BOB" }, BMD: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} BMD" }, BIF: { money_format: "&#70;&#66;&#117; {{amount}}", money_with_currency_format: "&#70;&#66;&#117; {{amount}} BIF" }, BWP: { money_format: "P{{amount}}", money_with_currency_format: "P{{amount}} BWP" }, BND: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} BND" }, CVE: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} CVE" }, KMF: { money_format: "&#67;&#70; {{amount}}", money_with_currency_format: "&#67;&#70; {{amount}} KMF" }, CUC: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} CUC" }, CUP: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} CUP" }, CDF: { money_format: "&#70;&#67; {{amount}}", money_with_currency_format: "&#70;&#67; {{amount}} CDF" }, DJF: { money_format: "&#70;&#100;&#106; {{amount}}", money_with_currency_format: "&#70;&#100;&#106; {{amount}} DJF" }, ERN: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} ERN" }, FKP: { money_format: "&#163; {{amount}}", money_with_currency_format: "&#163; {{amount}} FKP" }, GIP: { money_format: "&#163; {{amount}}", money_with_currency_format: "&#163; {{amount}} GIP" }, XAU: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} XAU" }, GGP: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} GGP" }, GNF: { money_format: "&#70;&#71; {{amount}}", money_with_currency_format: "&#70;&#71; {{amount}} GNF" }, HTG: { money_format: "&#71; {{amount}}", money_with_currency_format: "&#71; {{amount}} HTG" }, XDR: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} XDR" }, IDR: { money_format: "{{amount_with_comma_separator}} IDR", money_with_currency_format: "Rp {{amount_with_comma_separator}} IDR" }, IQD: { money_format: "&#1593;.&#1583; {{amount}}", money_with_currency_format: "&#1593;.&#1583; {{amount}} IQD" }, IMP: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} IMP" }, LAK: { money_format: "&#8365; {{amount}}", money_with_currency_format: "&#8365; {{amount}} LAK" }, LSL: { money_format: "&#76; {{amount}}", money_with_currency_format: "&#76; {{amount}} LSL" }, LRD: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} LRD" }, LYD: { money_format: "&#1604;.&#1583; {{amount}}", money_with_currency_format: "&#1604;.&#1583; {{amount}} LYD" }, MWK: { money_format: "&#77;&#75; {{amount}}", money_with_currency_format: "&#77;&#75; {{amount}} MWK" }, MRO: { money_format: "&#85;&#77; {{amount}}", money_with_currency_format: "&#85;&#77; {{amount}} MRO" }, KPW: { money_format: "&#8361; {{amount}}", money_with_currency_format: "&#8361; {{amount}} KPW" }, OMR: { money_format: "{{amount_with_comma_separator}} OMR", money_with_currency_format: "{{amount_with_comma_separator}} OMR" }, PAB: { money_format: "&#66;&#47;&#46; {{amount}}", money_with_currency_format: "&#66;&#47;&#46; {{amount}} PAB" }, SHP: { money_format: "&#163; {{amount}}", money_with_currency_format: "&#163; {{amount}} SHP" }, SVC: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} SVC" }, SLL: { money_format: "&#76;&#101; {{amount}}", money_with_currency_format: "&#76;&#101; {{amount}} SLL" }, XAG: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} XAG" }, SBD: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} SBD" }, SOS: { money_format: "&#83; {{amount}}", money_with_currency_format: "&#83; {{amount}} SOS" }, SDG: { money_format: "&#163; {{amount}}", money_with_currency_format: "&#163; {{amount}} SDG" }, SRD: { money_format: "&#36; {{amount}}", money_with_currency_format: "&#36; {{amount}} SRD" }, SZL: { money_format: "&#76; {{amount}}", money_with_currency_format: "&#76; {{amount}} SZL" }, TJS: { money_format: "&#84;&#74;&#83; {{amount}}", money_with_currency_format: "&#84;&#74;&#83; {{amount}} TJS" }, TOP: { money_format: "&#84;&#36; {{amount}}", money_with_currency_format: "&#84;&#36; {{amount}} TOP" }, TMT: { money_format: "&#109; {{amount}}", money_with_currency_format: "&#109; {{amount}} TMT" }, UZS: { money_format: "&#1083;&#1074; {{amount}}", money_with_currency_format: "&#1083;&#1074; {{amount}} UZS" }, YER: { money_format: "&#65020; {{amount}}", money_with_currency_format: "&#65020; {{amount}} YER" }, BGN: { money_format: "{{amount}} Đ»Đ˛", money_with_currency_format: "{{amount}} Đ»Đ˛ BGN" }, MMK: { money_format: "K{{amount}}", money_with_currency_format: "K{{amount}} MMK" }, KHR: { money_format: "KHR{{amount}}", money_with_currency_format: "KHR{{amount}}" }, KYD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} KYD" }, XAF: { money_format: "FCFA{{amount}}", money_with_currency_format: "FCFA{{amount}} XAF" }, CLP: { money_format: "${{amount_no_decimals}}", money_with_currency_format: "${{amount_no_decimals}} CLP" }, CNY: { money_format: "&#165;{{amount}}", money_with_currency_format: "&#165;{{amount}} CNY" }, COP: { money_format: "${{amount_with_comma_separator}}", money_with_currency_format: "${{amount_with_comma_separator}} COP" }, CRC: { money_format: "&#8353; {{amount_with_comma_separator}}", money_with_currency_format: "&#8353; {{amount_with_comma_separator}} CRC" }, HRK: { money_format: "{{amount_with_comma_separator}} kn", money_with_currency_format: "{{amount_with_comma_separator}} kn HRK" }, CZK: { money_format: "{{amount_with_comma_separator}} K&#269;", money_with_currency_format: "{{amount_with_comma_separator}} K&#269;" }, DKK: { money_format: "{{amount_with_comma_separator}}", money_with_currency_format: "kr.{{amount_with_comma_separator}}" }, DOP: { money_format: "RD$ {{amount}}", money_with_currency_format: "RD$ {{amount}}" }, XCD: { money_format: "${{amount}}", money_with_currency_format: "EC${{amount}}" }, EGP: { money_format: "LE {{amount}}", money_with_currency_format: "LE {{amount}} EGP" }, ETB: { money_format: "Br{{amount}}", money_with_currency_format: "Br{{amount}} ETB" }, XPF: { money_format: "{{amount_no_decimals_with_comma_separator}} XPF", money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} XPF" }, FJD: { money_format: "${{amount}}", money_with_currency_format: "FJ${{amount}}" }, GMD: { money_format: "D {{amount}}", money_with_currency_format: "D {{amount}} GMD" }, GHS: { money_format: "GH&#8373;{{amount}}", money_with_currency_format: "GH&#8373;{{amount}}" }, GTQ: { money_format: "Q{{amount}}", money_with_currency_format: "{{amount}} GTQ" }, GYD: { money_format: "G${{amount}}", money_with_currency_format: "${{amount}} GYD" }, GEL: { money_format: "{{amount}} GEL", money_with_currency_format: "{{amount}} GEL" }, HNL: { money_format: "L {{amount}}", money_with_currency_format: "L {{amount}} HNL" }, HKD: { money_format: "${{amount}}", money_with_currency_format: "HK${{amount}}" }, HUF: { money_format: "{{amount_no_decimals_with_comma_separator}}", money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} Ft" }, ISK: { money_format: "{{amount_no_decimals}} kr", money_with_currency_format: "{{amount_no_decimals}} kr ISK" }, INR: { money_format: "Rs. {{amount}}", money_with_currency_format: "Rs. {{amount}}" }, IDR: { money_format: "{{amount_with_comma_separator}}", money_with_currency_format: "Rp {{amount_with_comma_separator}}" }, ILS: { money_format: "{{amount}} NIS", money_with_currency_format: "{{amount}} NIS" }, JMD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} JMD" }, JPY: { money_format: "&#165;{{amount_no_decimals}}", money_with_currency_format: "&#165;{{amount_no_decimals}} JPY" }, JEP: { money_format: "&pound;{{amount}}", money_with_currency_format: "&pound;{{amount}} JEP" }, JOD: { money_format: "{{amount}}0 JD", money_with_currency_format: "{{amount}}0 JOD" }, KZT: { money_format: "{{amount}} KZT", money_with_currency_format: "{{amount}} KZT" }, KES: { money_format: "KSh{{amount}}", money_with_currency_format: "KSh{{amount}}" }, KWD: { money_format: "{{amount}}0 KD", money_with_currency_format: "{{amount}}0 KWD" }, KGS: { money_format: "Đ»Đ˛{{amount}}", money_with_currency_format: "Đ»Đ˛{{amount}}" }, LVL: { money_format: "Ls {{amount}}", money_with_currency_format: "Ls {{amount}} LVL" }, LBP: { money_format: "L&pound;{{amount}}", money_with_currency_format: "L&pound;{{amount}} LBP" }, LTL: { money_format: "{{amount}} Lt", money_with_currency_format: "{{amount}} Lt" }, MGA: { money_format: "Ar {{amount}}", money_with_currency_format: "Ar {{amount}} MGA" }, MKD: { money_format: "Đ´ĐµĐ˝ {{amount}}", money_with_currency_format: "Đ´ĐµĐ˝ {{amount}} MKD" }, MOP: { money_format: "MOP${{amount}}", money_with_currency_format: "MOP${{amount}}" }, MVR: { money_format: "Rf{{amount}}", money_with_currency_format: "Rf{{amount}} MRf" }, MXN: { money_format: "$ {{amount}}", money_with_currency_format: "$ {{amount}} MXN" }, MYR: { money_format: "RM{{amount}} MYR", money_with_currency_format: "RM{{amount}} MYR" }, MUR: { money_format: "Rs {{amount}}", money_with_currency_format: "Rs {{amount}} MUR" }, MDL: { money_format: "{{amount}} MDL", money_with_currency_format: "{{amount}} MDL" }, MAD: { money_format: "{{amount}} dh", money_with_currency_format: "Dh {{amount}} MAD" }, MNT: { money_format: "{{amount_no_decimals}} &#8366", money_with_currency_format: "{{amount_no_decimals}} MNT" }, MZN: { money_format: "{{amount}} Mt", money_with_currency_format: "Mt {{amount}} MZN" }, NAD: { money_format: "N${{amount}}", money_with_currency_format: "N${{amount}} NAD" }, NPR: { money_format: "Rs{{amount}}", money_with_currency_format: "Rs{{amount}} NPR" }, ANG: { money_format: "&fnof;{{amount}}", money_with_currency_format: "{{amount}} NA&fnof;" }, NZD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} NZD" }, NIO: { money_format: "C${{amount}}", money_with_currency_format: "C${{amount}} NIO" }, NGN: { money_format: "&#8358;{{amount}}", money_with_currency_format: "&#8358;{{amount}} NGN" }, NOK: { money_format: "kr {{amount_with_comma_separator}}", money_with_currency_format: "kr {{amount_with_comma_separator}} NOK" }, OMR: { money_format: "{{amount_with_comma_separator}} OMR", money_with_currency_format: "{{amount_with_comma_separator}} OMR" }, PKR: { money_format: "Rs.{{amount}}", money_with_currency_format: "Rs.{{amount}} PKR" }, PGK: { money_format: "K {{amount}}", money_with_currency_format: "K {{amount}} PGK" }, PYG: { money_format: "Gs. {{amount_no_decimals_with_comma_separator}}", money_with_currency_format: "Gs. {{amount_no_decimals_with_comma_separator}} PYG" }, PEN: { money_format: "S/. {{amount}}", money_with_currency_format: "S/. {{amount}} PEN" }, PHP: { money_format: "&#8369;{{amount}}", money_with_currency_format: "&#8369;{{amount}} PHP" }, PLN: { money_format: "{{amount_with_comma_separator}} zl", money_with_currency_format: "{{amount_with_comma_separator}} zl PLN" }, QAR: { money_format: "QAR {{amount_with_comma_separator}}", money_with_currency_format: "QAR {{amount_with_comma_separator}}" }, RON: { money_format: "{{amount_with_comma_separator}} lei", money_with_currency_format: "{{amount_with_comma_separator}} lei RON" }, RUB: { money_format: "&#1088;&#1091;&#1073;{{amount_with_comma_separator}}", money_with_currency_format: "&#1088;&#1091;&#1073;{{amount_with_comma_separator}} RUB" }, RWF: { money_format: "{{amount_no_decimals}} RF", money_with_currency_format: "{{amount_no_decimals}} RWF" }, WST: { money_format: "WS$ {{amount}}", money_with_currency_format: "WS$ {{amount}} WST" }, SAR: { money_format: "{{amount}} SR", money_with_currency_format: "{{amount}} SAR" }, STD: { money_format: "Db {{amount}}", money_with_currency_format: "Db {{amount}} STD" }, RSD: { money_format: "{{amount}} RSD", money_with_currency_format: "{{amount}} RSD" }, SCR: { money_format: "Rs {{amount}}", money_with_currency_format: "Rs {{amount}} SCR" }, SGD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} SGD" }, SYP: { money_format: "S&pound;{{amount}}", money_with_currency_format: "S&pound;{{amount}} SYP" }, ZAR: { money_format: "R {{amount}}", money_with_currency_format: "R {{amount}} ZAR" }, KRW: { money_format: "&#8361;{{amount_no_decimals}}", money_with_currency_format: "&#8361;{{amount_no_decimals}} KRW" }, LKR: { money_format: "Rs {{amount}}", money_with_currency_format: "Rs {{amount}} LKR" }, SEK: { money_format: "{{amount_no_decimals}} kr", money_with_currency_format: "{{amount_no_decimals}} kr SEK" }, CHF: { money_format: "SFr. {{amount}}", money_with_currency_format: "SFr. {{amount}} CHF" }, TWD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} TWD" }, THB: { money_format: "{{amount}} &#xe3f;", money_with_currency_format: "{{amount}} &#xe3f; THB" }, TZS: { money_format: "{{amount}} TZS", money_with_currency_format: "{{amount}} TZS" }, TTD: { money_format: "${{amount}}", money_with_currency_format: "${{amount}} TTD" }, TND: { money_format: "{{amount}}", money_with_currency_format: "{{amount}} DT" }, TRY: { money_format: "{{amount}}TL", money_with_currency_format: "{{amount}}TL" }, UGX: { money_format: "Ush {{amount_no_decimals}}", money_with_currency_format: "Ush {{amount_no_decimals}} UGX" }, UAH: { money_format: "â‚´{{amount}}", money_with_currency_format: "â‚´{{amount}} UAH" }, AED: { money_format: "Dhs. {{amount}}", money_with_currency_format: "Dhs. {{amount}} AED" }, UYU: { money_format: "${{amount_with_comma_separator}}", money_with_currency_format: "${{amount_with_comma_separator}} UYU" }, VUV: { money_format: "${{amount}}", money_with_currency_format: "${{amount}}VT" }, VEF: { money_format: "Bs. {{amount_with_comma_separator}}", money_with_currency_format: "Bs. {{amount_with_comma_separator}} VEF" }, VND: { money_format: "{{amount_no_decimals_with_comma_separator}}&#8363;", money_with_currency_format: "{{amount_no_decimals_with_comma_separator}} VND" }, XBT: { money_format: "{{amount_no_decimals}} BTC", money_with_currency_format: "{{amount_no_decimals}} BTC" }, XOF: { money_format: "CFA{{amount}}", money_with_currency_format: "CFA{{amount}} XOF" }, ZMW: { money_format: "K{{amount_no_decimals_with_comma_separator}}", money_with_currency_format: "ZMW{{amount_no_decimals_with_comma_separator}}" }}
        this.currentCurrency = bstore.get('currentCurrency')
        this.format = _settings.currencyFormat || "money_with_currency_format"
        this.events = events
        if(this.currentCurrency && Shopify.currency.active !== this.currentCurrency){
            this.convertAll({})
        }
        this.events.on('booster:content:update', (params = {})=>this.convertAll(params))
        this.events.on('booster:price:update', this.priceUpdate.bind(this))
    }

    formatMoney(o, m) {
        "string" == typeof o && (o = o.replace(".", ""));
        var t = "",
            n = /\{\{\s*(\w+)\s*\}\}/,
            a = m || "${{amount}}";
    
        function _(o, m) {
            return void 0 === o ? m : o
        }
    
        function r(o, m, t, n) {
            if (m = _(m, 2), t = _(t, ","), n = _(n, "."), isNaN(o) || null == o) return 0;
            var a = (o = (o / 100).toFixed(m)).split(".");
            return a[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + t) + (a[1] ? n + a[1] : "")
        }
        switch (a.match(n)[1]) {
            case "amount":
                t = r(o, 2);
                break;
            case "amount_no_decimals":
                t = r(o, 0);
                break;
            case "amount_with_comma_separator":
                t = r(o, 2, ".", ",");
                break;
            case "amount_no_decimals_with_comma_separator":
                t = r(o, 0, ".", ",")
        }
        return a.replace(n, t)
    }

    priceUpdate({elements}){
        let oldCurrency = Shopify.currency.active
        let newCurrency = bstore.get("currentCurrency")
        let newFormat = this.getFormat(newCurrency)
        let oldFormat = this.getFormat(oldCurrency)
        if(oldCurrency == newCurrency) return
        for(let element of elements){
            this.elemConvert({element, oldCurrency, newCurrency, oldFormat, newFormat})
        }
    }

    elemConvert({element, oldCurrency = false, newCurrency = false, newFormat = false, oldFormat = false}){
        let amount = element.innerText
        if(!amount || amount.trim() == '') return
        let oldc = oldCurrency || Shopify.currency.active
        if(!oldc) return
        let newc = newCurrency || bstore.get("currentCurrency")
        if(!newc) return
        let newf = newFormat || this.getFormat(newc)
        let oldf = oldFormat || this.getFormat(oldc)
        let u;

        u = -1 !== oldf.indexOf("amount_no_decimals") ? Currency.convert(100 * parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc) : "JOD" === oldc || "KWD" == oldc || "BHD" == oldc ? Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10) / 10, oldc, newc) : Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc)

        element.innerHTML = this.formatMoney(u, newf)
        element.dataset.currency = newc
    }

    convert({amount = false, oldc = false, newc = false}){
        if(!amount) return amount
        oldc = oldc || Shopify.currency.active
        if(!oldc) return amount
        newc = newc || bstore.get("currentCurrency")
        if(!newc) return amount
        let newf = this.getFormat(newc)
        let oldf = this.getFormat(oldc)
        let u
        u = -1 !== oldf.indexOf("amount_no_decimals") ? Currency.convert(100 * parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc) : "JOD" === oldc || "KWD" == oldc || "BHD" == oldc ? Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10) / 10, oldc, newc) : Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc)

        return this.formatMoney(u, newf)
    }

    convertAll({oldCurrency = false, newCurrency = false, selector = '.jsPrice', format = this.format}) {
        let oldc = oldCurrency || Shopify.currency.active
        if(!oldc) return

        let newc = newCurrency || bstore.get("currentCurrency")
        if(!newc) return
        if(newc == oldc) return
        let oldf = this.moneyFormats[oldc][format] || '{{amount}}'
        let newf = this.moneyFormats[newc][format] || '{{amount}}'

        let conts = document.querySelectorAll(selector)

        for(let i = 0, maxi = conts.length; i < maxi; ++i){
            let u;
            let elem = conts[i]
            if(elem.dataset.currency == newc) continue
            let amount = elem.innerText
            if(!amount || amount.trim() == '') continue

            u = -1 !== oldf.indexOf("amount_no_decimals") ? Currency.convert(100 * parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc) : "JOD" === oldc || "KWD" == oldc || "BHD" == oldc ? Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10) / 10, oldc, newc) : Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc)

            elem.innerHTML = this.formatMoney(u, newf)
            elem.dataset.currency = newc
        }

        let currencySymbol = document.querySelectorAll('.curreny-symbol');
        if(currencySymbol) {
            currencySymbol.forEach((e) => {
                let u;
                let amount = e.innerText
                u = -1 !== oldf.indexOf("amount_no_decimals") ? Currency.convert(100 * parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc) : "JOD" === oldc || "KWD" == oldc || "BHD" == oldc ? Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10) / 10, oldc, newc) : Currency.convert(parseInt(amount.replace(/[^0-9]/g, ""), 10), oldc, newc)
                let str = this.formatMoney(u, newf).replace('0', '').replace('.', '')
                e.innerHTML = str
            })
        }

        bstore.set('currentCurrency', newc)
        this.currentCurrency = newc
    }

    getFormat(currency = false, format = false){
        format = format || _settings.currencyFormat || "money_with_currency_format"
        currency = currency || Shopify.currency.active
        return this.moneyFormats[currency][format]
    }
}

class BstrFreeShipping{
    constructor({events, cfx}){
        this.events = events
        this.cfx = cfx
        this.goal = parseFloat(_settings.freeShippingAmount.trim()) * 100
        this.current = 0
        this.format = this.cfx.getFormat(Shopify.currency.active)
        this.events.on('booster:cart:update', this.updateBars.bind(this))
        this.events.on('booster:content:update', this.updateBars.bind(this))
    }

    updateBars(params = {}){
        let current = params.data && params.data.total_raw || this.current
        this.current = current
        let percentage = Math.min(current / this.goal * 100, 100)
        let left = this.cfx.convert({amount: this.cfx.formatMoney(this.goal - current, this.format)})
        let bars = document.querySelectorAll('[data-free-shipping-bar]')
        let texts = document.querySelectorAll('[data-free-shipping-text]')
        for(let b of bars){
            b.style.width = percentage + '%'
        }
        for(let t of texts){
            t.innerHTML = percentage == 100 ? t.dataset.gotFreeShipping : t.dataset.freeShippingText.replace('%AMOUNT%', `<span class="jsPrice">${left}</span>`)
        }
    }
}

class BstrLocalize{
    constructor({events, cfx}){
        this.events = events
        this.cfx = cfx
        if(_settings.geolocation){
            this.events.on('booster:geo:visitor', this.localize.bind(this))
        }
    }

    async localize(params){
        if(bstore.get('bstrLocalized')) return
        bstore.set('bstrLocalized', true, 1440)

        let currency = params.currency.code
        let language = params.language.code
        let return_to = window.location.pathname
        let redirect = false

        if(language != Shopify.locale && Object.keys(bstri18n.locales).includes(language)){
            let lang = bstri18n.locales[language];
            let current = bstri18n.locales[Shopify.locale];
            if(!current.primary){
                return_to = return_to.replace(`${current.url}`, '');
            }
            if(!lang.primary){
                return_to = `${lang.url}${return_to}`;
            }
            redirect = true;
        }

        let mode = bstri18n.currency_mode;
        let currencies = bstri18n.currencies;
  
        if(mode != 'none' && currencies.includes(currency)){
            if(mode == 'convert' && bstore.get('currentCurrency') != currency){
                this.cfx.convertAll({oldCurrency: bstore.get('currentCurrency') || Shopify.currency.active, newCurrency: currency});
                this.events.trigger('booster:currency:changed')
            } else if(Shopify.currency.active != currency) {
                let form = new FormData();
                form.append('form_type', 'currency');
                form.append('currency', currency);
                await fetch(`${window.Shopify.routes.root}cart/update`, {body: form, method: 'POST'});
                if(!redirect){
                    return window.location.reload();
                }
            }
        }

        if(redirect) return window.location = return_to
    }
}

class BstrCntr{
    constructor(id = '[data-bstr-cntr]'){
        this.id = id
        this.counters = []
        this.interval = false
        this.initCounters()
    }

    initCounters(){
        let cts = document.querySelectorAll(`${this.id}:not([data-bstr-initd])`)
        if(!cts.length){
            return
        }
        let interval = parseInt(cts[0].dataset.bstrCntrInterval) * 1000
        if(this.interval){
            clearInterval(this.interval)
        }
        for(let ct of cts){
            this.counters.push(ct)
            ct.dataset.bstrInitd = "true"
        }
        this.interval = setInterval(this.countManagement.bind(this), interval)
    }

    countManagement(){
        let cache = {};
        for (let i = 0, maxi = this.counters.length; i < maxi; ++i) {
          let item = this.counters[i];
          if (cache[item.dataset.bstrCntrId]) {
            item.innerText = cache[item.dataset.bstrCntrId];
            continue;
          }
          let limit = item.dataset.bstrCntrLimit;
          let current = parseInt(item.innerText) || limit;
          let value = getRandomInt(Math.max(current - current * 0.1, 1), Math.min(current + current * 0.1, limit));
          item.innerText = value;
          cache[item.dataset.bstrCntrId] = value;
        }
    }
}

class BstrCopycat{
    constructor(){
        document.addEventListener('contextmenu', function(e) {
            return e.preventDefault();
        });
        this.preventInspectElement();
        
        if(_settings.copycatText){
            this.preventTextSelect();
        }
    }

    preventTextSelect(){
        let style = document.createElement('style');
        style.innerText = `*:not(textarea):not(input):not(select):not(form):not(datalist):not(fieldset):not(option) {-webkit-touch-callout: none !important;-webkit-user-select: none !important;-khtml-user-select: none !important;-moz-user-select: none !important;-ms-user-select: none !important;user-select: none !important;}`
        document.body.appendChild(style);
    }

    preventInspectElement(){
        document.onkeydown = function(e) {
            if (e.defaultPrevented) {
                return;
            }

            if(e.code == "F12" || e.key == "F12"){
                return false;
            }

            if(e.ctrlKey && e.shiftKey && (e.key == "j" || e.key == "J" || e.code == "KeyJ")) {
                return false;
            }

            if(e.ctrlKey && e.shiftKey && (e.key == "c" || e.key == "C" || e.code == "KeyC")) {
                return false;
            }

            if(e.ctrlKey && e.shiftKey && (e.key == "i" || e.key == "I" || e.code == "KeyI")) {
                return false;
            }

            if(e.ctrlKey && (e.key == "u" || e.key == "U" || e.code == "KeyU")) {
                return false;
            }

            if(_settings.copycatText){
                if(e.ctrlKey && (e.key == "c" || e.key == "C" || e.code == "KeyC")) {
                return false;
                }
        
                if(e.ctrlKey && (e.key == "a" || e.key == "A" || e.code == "KeyA")) {
                return false;
                }
        
                if(e.ctrlKey && (e.key == "x" || e.key == "X" || e.code == "KeyX")) {
                return false;
                }
            }
        }
    }
}

class BstrCountdown {
    constructor({events}){
        this.events = events
        this.init()
        this.events.on('booster:content:update', ()=>this.init())
    }


    async init(container = document){
        let bstrCts = container.querySelectorAll('[data-countdown]')
        if(!this.bstrCts){
            this.bstrCts = [...bstrCts];
        } else {
            this.bstrCts.push(...bstrCts);
        }

        let ctSettings = bstore.get('bstrCts');
        if(!ctSettings){
            ctSettings = {}
        }
        let time = new Date().getTime();
        let randomize = parseInt(_settings.countdownRandom);

        function enumMultiplier(format){
            switch (format) {
                case 'days':
                    return 86400000;
                case 'hours':
                    return 3600000;
                case 'minutes':
                    return 60000;
                case 'seconds':
                    return 1000;
                default:
                    return 86400000;
            }
        }

        let expiry, minExp, maxExp;
        if(_settings.countdownTime.includes('/')){
            expiry = new Date(_settings.countdownTime).getTime();
            minExp = expiry - randomize * 86400000;
            maxExp = expiry + randomize * 86400000;
        } else {
            let expiry = parseInt(_settings.countdownTime);
            let multiply = enumMultiplier(_settings.countdownTimeFormat);
            minExp = time + Math.abs(expiry - randomize) * multiply;
            maxExp = time + Math.abs(expiry + randomize) * multiply;
        }

        function getExpiry(timer, type, set = true){
            if(type == 'app'){
                let newTime = getRandomInt(minExp, maxExp);
                timer.dataset.expiryTime = newTime;
                return newTime;
            } else {
                let expiry;
                let duration = timer.dataset.duration;
                if(duration.includes('/')){
                    expiry = new Date(duration).getTime();
                } else {
                    expiry = time + parseInt(duration) * enumMultiplier(timer.dataset.durationFormat);
                }
                if(!set){
                    return expiry;
                }
                timer.dataset.expiryTime = expiry;
                return expiry;
            }
        }

        for(let i = 0, maxi = bstrCts.length; i < maxi; ++i){
            let timer = bstrCts[i];
            timer.removeAttribute('data-countdown');
            let key = timer.dataset.ctKey;
            let ctType = timer.dataset.duration && timer.dataset.durationFormat ? 'block' : 'app';
            
            if(!ctSettings[key] || ctSettings[key] < time || Shopify.designMode){
                let expires = getExpiry(timer, ctType);
                ctSettings[key] = expires;
            } else {
                if(ctType == 'app'){
                    if(ctSettings[key] > maxExp){
                        let newTime = getRandomInt(minExp, maxExp);
                        ctSettings[key] = newTime;
                        timer.dataset.expiryTime = newTime;
                    } else {
                        timer.dataset.expiryTime = ctSettings[key];
                    }
                } else {
                    let expires = getExpiry(timer, ctType, false);
                    if(ctSettings[key] > expires){
                        timer.dataset.expiryTime = expiry;
                        ctSettings[key] = expires;
                    } else {
                        timer.dataset.expiryTime = ctSettings[key];
                    }
                }
            }
        }

        bstore.set('bstrCts', ctSettings, 1440);
        if(!this.countdownStarted){
            setInterval(this.tickCountdowns.bind(this), 1000);
            this.countdownStarted = true;
        }        
    }


    tickCountdowns(){
        for(let i = 0, maxi = this.bstrCts.length; i < maxi; ++i){
            this.tickCountdown(this.bstrCts[i]);
        }
    }

    tickCountdown(ct){
        if(ct.dataset.countdownTimedOut == "true"){
            return;
        }

        let delta = (parseInt(ct.dataset.expiryTime) - Date.now()) / 1000;

        let daysEl = ct.querySelector('.days');
        let hoursEl = ct.querySelector('.hours');
        let minutesEl = ct.querySelector('.minutes');
        let secondsEl = ct.querySelector('.seconds');

        if(delta <= 0){
            if(ct.dataset.ctKey == "cart-ct-timer"){
                ct.dataset.expiryTime = Date.now() + 300000
                return
            }
            ct.dataset.countdownTimedOut = "true";
            if(daysEl) daysEl.innerText = "00";
            if(hoursEl) hoursEl.innerText = "00";
            if(minutesEl) minutesEl.innerText = "00";
            if(secondsEl) secondsEl.innerText = "00";
            return;
        }

        let days = Math.floor(delta / 86400);
        if(daysEl) daysEl.innerText = days >= 10 && days || "0"+days;
        delta -= days * 86400;

        let hours = Math.floor(delta / 3600) % 24;
        delta -= hours * 3600;
        if(hoursEl) hoursEl.innerText = hours >= 10 && hours || "0"+hours;

        let minutes = Math.floor(delta / 60) % 60;
        delta -= minutes * 60;
        if(minutesEl) minutesEl.innerText = minutes >= 10 && minutes || "0"+minutes;

        let seconds = delta % 60;
        if(secondsEl) secondsEl.innerText = seconds >= 10 && Math.floor(seconds) || "0"+Math.floor(seconds); 
    }
}

class BstrDynTitle{
    constructor(){
        this.originalTitle = document.title
        let intr = parseInt(_settings.dynTitleIntr)
        this.intr = isNaN(intr) ? 2500 : intr * 1000
        this.initLeavePage()
        this.initOnPage()
    }

    initLeavePage(){
        let titles = _settings.BPDynTitle.trim().split('\n')
        this.LPTitles = [this.originalTitle, ...titles]
        window.addEventListener('blur', ()=>{
            clearInterval(this.OPRotation)
            this.OPRotation = false
            document.title = this.originalTitle
            if(titles[0] == "") return
            if(this.LPRotation) return
            this.LPRotation = setInterval(()=>this.rotateTitles(this.LPTitles), this.intr)
        })
    }

    initOnPage(){
        let titles = _settings.OPDynTitle.trim().split('\n')
        this.OPTitles = [this.originalTitle, ...titles]
        window.addEventListener('focus', ()=>{
            clearInterval(this.LPRotation)
            this.LPRotation = false
            document.title = this.originalTitle
            if(titles[0] == "") return
            if(this.OPRotation) return
            this.OPRotation = setInterval(()=>this.rotateTitles(this.OPTitles), this.intr)
        })
        if(!this.LPRotation && titles[0] != ""){
            this.OPRotation = setInterval(()=>this.rotateTitles(this.OPTitles), this.intr)
        }
    }

    rotateTitles(titles){
        let len = titles.length
        let ct = titles.indexOf(document.title)
        ++ct
        if(ct >= len) ct = 0
        document.title = titles[ct]
    }
}

class BstrElements{
    constructor({events, basync, cfx, cart}){
        this.events = events
        this.cfx = cfx
        this.cart = cart
        this.basync = basync
        this.stock = new BstrStock({events})
        this.marqueeIntervals = {}
        this.cardTemplate = document.getElementById('productCardTemplate')
        this.checkPagination()
        this.initMarquees()
        this.initElements()
        this.events.on('booster:content:update', this.initElements.bind(this))
        this.events.on('booster:currency:changed', ()=>this.cfxInput())
        this.rendering = false;
    }

    initElements(){
        this.quantityHandlers()
        this.cfxInput()
        this.initSearch()
        this.boosterRevert()
        this.localizeDates()
    }

    async initMarquees(){
        let marquees = document.querySelectorAll('[data-blocktype="barTextMarquee"]');
        for(let i = 0, maxi = marquees.length; i < maxi; i++){
          let element = marquees[i];
          let id = element.dataset.blockid;
          var self = this;
          this.marqueeIntervals[id] = setInterval(self.scrollMarquee, 2000, element);
        }
      }
  
      scrollMarquee(container){
        if(container.dataset.currentmessage >= container.dataset.messagescount){
            container.dataset.currentmessage = 0;
            container.style.transform = "translateY(0%)";
            return;
        }
        container.dataset.currentmessage++;
        container.style.transform = `translateY(-${container.dataset.currentmessage * 100}%)`;
      }

    checkPagination(){
        if(_settings.pagination == "infinite"){
            let pList = document.querySelector('.row--product.product__list');
            if(!pList){
                return;
            }
            self = this
            window.addEventListener('scroll', debounce( ()=>{
                if((window.innerHeight + window.scrollY) >= pList.offsetHeight && this.rendering === false){
                    let next = document.querySelector('.pagination--hidden');
                    if(!next){
                        return;
                    }
                    this.rendering = true;
                    self.renderChangePage(false, next, false);
                }
            }, 250));
        }
    }

    boosterRevert(){
        let reverts = document.querySelectorAll('.booster--revert div:not(.booster--revert)');
        for(let r = 0, maxr = reverts.length; r < maxr; ++r){
          reverts[r].classList.add('booster--revert');
        }
    }

    initSearch(){
        let searchFields = document.querySelectorAll('input[data-search]:not([data-bstr-initd])');
        for(let i = 0, maxi = searchFields.length; i < maxi; ++i){
            searchFields[i].dataset.bstrInitd = "true"
            searchFields[i].oninput = debounce(this.searchSuggest.bind(this), 230, false);
        }
    }

    cfxInput(){
        if(bstri18n.currency_mode == "convert"){
            let c = bstore.get('currentCurrency')
            if(!c) return
            if(c == Shopify.currency.active) return
            document.querySelectorAll('[data-currency-selector]').forEach((e)=>{
                e.value = c
            })
        }
    }

    quantityHandlers(){
        let inputs = document.querySelectorAll('[data-qty-int-input]:not([data-bstr-initd])')
        for(let inp of inputs){
            inp.dataset.bstrInitd = "true"
            inp.oninput = debounce((e)=>{inp.onchange(e)}, 500, false)
        }
    }

    convertCurrencyChange(select){
        let currency = select.value
        if(currency == bstore.get('currentCurrency')) return
        this.cfx.convertAll({oldCurrency: bstore.get('currentCurrency') || Shopify.currency.active, newCurrency: currency})
    }

    submitCurrencyChange(select){
        return select.closest('form').submit()
    }

    languageChange(select){
        return window.location = select.value
    }

    stickyBuy(button, e){
        if(button.dataset.productId){
            let container = button.closestEl('.sticky--mobile')
            if(container.classList.contains('sticky--closed')){
                return container.classList.remove('sticky--closed')
            }
        } else {
            let id = button.dataset.buyButton
            let form = document.getElementById('product_form_' + id)
            if(form) this.cart.addToCart(e, form)
        }
    }

    stickyBuyNow(button, e) {
        let id = button.dataset.buyButton
        let form = document.getElementById('product_form_' + id)
        let target = e.currentTarget;

        if(target){
            target.disabled = true
            target.querySelector('[data-button-text]').innerText = _bstrLocale.buttons.checking_out;
        }
        if(form) {
            var formData = new FormData(form);

            fetch(`${window.Shopify.routes.root}cart/add.js`, {
                method: 'POST',
                body: formData,
                headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                },
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                if(target){
                    target.disabled = false
                    target.querySelector('[data-button-text]').innerText = target.dataset.originalText
                }
                window.location = `${window.Shopify.routes.root}checkout`;
            })
            .catch(function(error) {
                console.error('Error:', error);
            });
        }
    }

    closeSticky(button){
        button.closest('.sticky--mobile').classList.add('sticky--closed')
    }

    async renderSort(select){
        let url = new URL(document.URL);
        url.searchParams.set('sort_by', select.value);
        url.searchParams.delete('page')
        let stateURL = url.href;
    
        let container = document.querySelector('.shopify-section.row--product.product__list');
        container.style.opacity = '0.5';
    
        let {html} = await this.basync.load({url, section: 'product-list', selector: '#shopify-section-product-list'})
        if(!html) return container.style.opacity = '1'
        container.innerHTML = html;
    
        history.replaceState({}, '', stateURL);
        this.events.trigger('booster:content:update', {trigger: 'sort'})
        container.style.opacity = '1';
    }

    submitSearch(target){
        let form = target.closestEl('form');
        form.submit();
    }
      
    openSearch(target){
        if(!target){
            target = document.querySelector('.search__container--abs');
            target.classList.add('focused');
            target = target.querySelector('input');
        } else {
            target.closestEl('[data-search-container]').classList.add('focused');
            if(target.tagName != "input"){
            target = target.closestEl('input');
            }
        }
        target.focus();

        const searchContainer = document.querySelector('[data-search-container].focused');
        searchContainer.closestEl('input').focus();

        let container = target.closestEl('[data-search-suggest]');
        if(!target.value.length){
            boosterTheme.handleEmptySearch(container);
        }
    }
    
    closeSearch(target){
        target.closestEl('[data-search-container]').classList.remove('focused');
    }

    renderProductCard(product){
        let card = this.cardTemplate.cloneNode(true).content.children[0];
        const $c = (q)=>card.querySelector(q)
        $c('.card__img--container').href = product.url;
        $c('.card__title').href = product.url;
        $c('.card__title').classList.add('card__title--searched');
        $c('[data-product-image]').src = product.featured_image.url;
        $c('.card__title').innerText = product.title;
        $c('.card__price').innerText = product.price;
        let countdown = $c('[data-countdown]');
        countdown.classList.add('hide');
        countdown.removeAttribute('data-countdown');
        if(!product.available){
            card.classList.add('card--soldout');
        }
        card.classList.add('col-md-1-5');
        return card;
    }

    createSearchSuggestResult(product){
        return this.renderProductCard(product);
    }

    populateSearchSuggest(container, data){
        var products = data.resources.results.products;
        var frag = document.createDocumentFragment();
        for(var i = 0, maxi = products.length; i < maxi; ++i){
            frag.appendChild(this.createSearchSuggestResult(products[i]));
        }
        container.innerHTML = '';
        container.appendChild(frag);

        var articles = data.resources.results.articles;

        if(articles.length > 0){
          var articleContainer = document.createElement('div');

          var articleTitle = document.createElement('h4');
          articleTitle.innerText = "Articles";
          articleTitle.style.marginTop = "0px"
          articleTitle.classList.add("col-12");

          articleContainer.append(articleTitle)

          var articleFrag = document.createDocumentFragment();
          for(var a = 0, a_maxi = articles.length; a < a_maxi; ++a){
              const element = document.createElement('a');
              element.href = articles[a].url
              element.innerText = articles[a].title
              element.classList.add("col-12");
              articleContainer.appendChild(element);
          }

          container.appendChild(articleContainer);
        }

        var pages = data.resources.results.pages;
        if(pages.length > 0){
          var pageContainer = document.createElement('div');

          var pageTitle = document.createElement('h4');
          pageTitle.innerText = "Pages";
          pageTitle.style.marginTop = "0px"
          pageTitle.classList.add("col-12");

          pageContainer.append(pageTitle)

          var pageFrag = document.createDocumentFragment();
          for(var p = 0, p_maxi = pages.length; p < p_maxi; ++p){
              const element = document.createElement('a');
              element.href = pages[p].url
              element.innerText = pages[p].title
              element.classList.add("col-12");
              pageContainer.appendChild(element);
          }
          container.appendChild(pageContainer);
        }

        return this.events.trigger('booster:content:update');
    }

    searchSuggest(event){
        var self = this;
        let query = event.target.value;
        let parent = event.target.closest('[data-search-container]');
        let container = parent.querySelector('[data-search-suggest]');
        if(query.length > 0){
            let q = `${window.Shopify.routes.root}search/suggest.json?q=${query}&resources[type]=product,page,article&resources[limit]=5&resources[options][unavailable_products]=last`;            
            fetch(q)
            .then(r=>r.json())
            .then(data=>self.populateSearchSuggest(container, data));
        } else {
            return this.handleEmptySearch(container);
        }
    }

    handleEmptySearch(container){
        container.innerHTML = emptySearch;
        return this.events.trigger('booster:content:update');
    }

    async quickBuy(e, btnType){
        e.preventDefault();
        const button = '<button class="close" onclick="closeModal(event)"><i class="uil uil-arrow-left"></i>' + _bstrLocale.buttons.back_to_shop + '</button>'
        const $e = (e, q)=>e.querySelector(q)
        let url = new URL(e.target.closest('a').href);
        let {parser} = await this.basync.load({url, section: 'product-page__product'})
        if(btnType === 'quickShop' || _settings.quickShop == false ){
            if($e(parser, '.product__row').classList.contains('product__row--marketplace')){
                let container = $e(parser, '.product__row');
                container.classList.remove('product__row--marketplace');
                let middle = $e(container, '.product__page--info');
                let title = $e(middle, '.product__title');
                let price = $e(middle, '.product__price--holder');
                container.removeChild(middle);
                let sticky = $e(container, '.product__page--info')
                if(!$e(sticky, '.product__title')) sticky.insertBefore(title, sticky.firstChild);
                if(!$e(sticky, '.product__price')) $e(sticky, '.product__title').insertAdjacentElement('afterend', price);
            }
            document.querySelector('.content').style.width = 'calc(100% - 80px)';
            let quickBuy = document.getElementById('quickbuy__modal');
            $e(quickBuy, '.content').innerHTML = button + $e(parser, 'body').innerHTML;
            quickBuy.style.display = 'flex';
        }else if(btnType === 'quickBuy'){
            let productInfoDiv = $e(parser, '.product__page--info');
            let productDescriptionDiv = $e(productInfoDiv, '.product__description');
            if (productDescriptionDiv) {
                productDescriptionDiv.remove();
            }
            let quickBuy = document.getElementById('quickbuy__modal');
            $e(quickBuy, '.content').innerHTML = button + productInfoDiv.outerHTML;
            document.querySelector('.content').style.width = '600px';
            document.querySelector('.product__page--info').classList.remove('col-md-6');
            document.querySelector('.product__page--info').style.marginTop = '32px';
            quickBuy.style.display = 'flex';
        }
        this.events.trigger('booster:content:update', {trigger: 'quickbuy'})
    }

    toggleTab(self, id){
        let tab = self;
        let container = tab.closest('.tab__container');
        container.querySelector('.tab--show').classList.remove('tab--show');
        container.querySelector(`#${id}`).classList.add('tab--show');
        let tabs = container.querySelector('.tab__holder');
        tabs.querySelector('.tab--active').classList.remove('tab--active');
        self.classList.add('tab--active');
      }
  
      toggleCollectionView(view, target){
        if(target.classList.contains('view--active')){
          return;
        }
        target.closestEl('.view--active').classList.remove('view--active');
        target.classList.add('view--active');
        let rows = document.querySelectorAll('.row--product');
        if(view == 'card'){
          for(var i = 0, maxi = rows.length; i < maxi; ++i){
            rows[i].classList.remove('card--expanded');
          }
        } else {
          for(var i = 0, maxi = rows.length; i < maxi; ++i){
            rows[i].classList.add('card--expanded');
          }
        }
      }

      async renderChangePage(e = false, clickTarget, overwrite = false){
        if(e) e.preventDefault()
        let container = document.querySelector('.product__list.row--product')
        container.style.opacity = '0.4'
        clickTarget.disabled = true
        
        let url = new URL(clickTarget.href)
        let {html} = await this.basync.load({url, selector: '.product__list.row--product'})
        if(!html){
            container.style.opacity = '1'
            return clickTarget.disabled = false
        }
    
        if(overwrite){
            container.innerHTML = html
            container.scrollIntoView({block: "start", behavior: "smooth"})
        } else {
            clickTarget.closest('.pagination').remove()
            container.innerHTML += html
        }

        this.rendering = false;
    
        let stateURL = new URL(document.URL);
        stateURL.searchParams.set('page', url.searchParams.get('page'));
        history.pushState({}, '', stateURL);
        
        container.style.opacity = '1';
        return this.events.trigger('booster:content:update', {trigger: 'pagination'})
      }

      localizeDates(){
        let dates = document.querySelectorAll('[data-bstr-delivery-date]:not([data-bstr-initd])')
        for(let date of dates){
            date.dataset.bstrInitd = "true"
            let n = parseInt(date.innerText.replace(/[^\d]/g, ''))
            if(isNaN(n)) continue
            let cdate = new Date()
            cdate.setDate(cdate.getDate() + n)
            const options = { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' };
            date.innerText = cdate.toLocaleDateString(`${Shopify.locale}`, options)
        }
    }
}

class BstrFilters{
    constructor({events, basync}){
        this.basync = basync
        this.events = events
        this.initListeners()
        this.events.on('booster:content:update', ()=>this.initListeners())
    }

    debounce(func, timeout = 500){
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    initListeners(){
        for(let e of document.querySelectorAll('input[data-filter-href]:not([data-bstr-initd])')) {
            e.dataset.bstrInitd = "true"
            e.addEventListener('change', this.modifyFilters.bind(this))
        }

        for(let e of document.querySelectorAll('[data-filter-href]:not([data-bstr-initd]):not(input)')) {
            e.dataset.bstrInitd = "true"
            e.addEventListener('click', this.modifyFilters.bind(this))
        }
        
        let params = new URL(document.location).searchParams;

        let priceRangeMin = document.querySelector('.priceRangeFilter__min:not([data-bstr-initd]');
        if(priceRangeMin) {
            if(params.get('filter.v.price.gte')) {
                priceRangeMin.value = params.get('filter.v.price.gte')
            } 
            priceRangeMin.dataset.bstrInitd = "true"
            priceRangeMin.addEventListener('keyup', this.debounce(this.priceRangeFilterMin.bind(this)))
        }

        let priceRangeMax = document.querySelector('.priceRangeFilter__max:not([data-bstr-initd]');
        if(priceRangeMax) {
            if(params.get('filter.v.price.lte')) {
                priceRangeMax.value = params.get('filter.v.price.lte')
            } 
            priceRangeMax.dataset.bstrInitd = "true"
            priceRangeMax.addEventListener('keyup', this.debounce(this.priceRangeFilterMax.bind(this)))
        }

        let resetPriceFilter = document.querySelector('.reset-price-filter:not([data-bstr-initd]');
        if(resetPriceFilter) { 
            resetPriceFilter.dataset.bstrInitd = "true"
            resetPriceFilter.addEventListener('click', this.resetPriceFilter.bind(this))
        }

        this.checkReset();

        const rangeInput = document.querySelectorAll(".priceRange__slider .range-input input:not([data-bstr-initd]"),
        priceInput = document.querySelectorAll(".min-max__container .price-input:not([data-bstr-initd]"),
        range = document.querySelector(".priceRange__slider .slider .progress:not([data-bstr-initd]");

        if(rangeInput && priceInput && range ) {
            let priceReset = document.querySelector('.reset-price-container');

            let priceGap = 10;
            rangeInput.forEach((e) => {
                e.dataset.bstrInitd = "true"
            })
            priceInput.forEach((e) => {
                e.dataset.bstrInitd = "true"
            })
       
            range.dataset.bstrInitd = "true"

            if(params.get('filter.v.price.gte')) {
                priceInput[0].innerHTML = params.get('filter.v.price.gte')
                rangeInput[0].value = params.get('filter.v.price.gte')
                range.style.left = ((params.get('filter.v.price.gte') / rangeInput[0].max) * 100) + "%";
                priceReset.classList.add('show');
            } 

            if(params.get('filter.v.price.lte')) {
                priceInput[1].innerHTML = params.get('filter.v.price.lte')
                rangeInput[1].value = params.get('filter.v.price.lte')
                range.style.right = 100 - (params.get('filter.v.price.lte') / rangeInput[1].max) * 100 + "%";
                priceReset.classList.add('show');
            } 

            rangeInput.forEach(input =>{
                input.addEventListener("input",  
                    e => {
                        let minVal = parseInt(rangeInput[0].value),
                        maxVal = parseInt(rangeInput[1].value);
                        if((maxVal - minVal) < priceGap){
                            if(e.target.className === "range-min"){
                                rangeInput[0].value = maxVal - priceGap
                            }else{
                                rangeInput[1].value = minVal + priceGap;
                            }
                        }else{
                            priceInput[0].innerHTML = minVal;
                            priceInput[1].innerHTML = maxVal;
                            range.style.left = ((minVal / rangeInput[0].max) * 100) + "%";
                            range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
                            
                        }
                    }
                );

                input.addEventListener("input",  
                    this.debounce( e => {
                        if(e.target.className === "range-min"){
                            this.debounce(this.priceRangeFilterMin(e))
                        }else{
                            this.debounce(this.priceRangeFilterMax(e))
                        }
                    })
                );
            });
        }
    }

    resetPriceFilter(event) {
        let url = new URL(document.location);
        url.searchParams.delete('filter.v.price.gte');
        url.searchParams.delete('filter.v.price.lte');

        const priceRangeMin = document.querySelector('.priceRangeFilter__min'),
        priceRangeMax = document.querySelector('.priceRangeFilter__max');
        if(priceRangeMin && priceRangeMax) {
            priceRangeMin.value = "";
            priceRangeMax.value = "";
        }

        const rangeMin = document.querySelector(".priceRange__slider .range-min"),
        rangeMax = document.querySelector(".priceRange__slider .range-max"),
        range = document.querySelector(".priceRange__slider .slider .progress"),
        priceMin = document.querySelector(".price-min.price-input"),
        priceMax = document.querySelector(".price-max.price-input")

        if(rangeMin && rangeMax && range && priceMin && priceMax) {
            priceMin.innerHTML = 0;
            priceMax.innerHTML = rangeMax.max;
    
            rangeMin.value = 0;
            rangeMax.value = rangeMax.max;
    
            range.style.left = "0";
            range.style.right = "0";
        }
       
        let searchUrl = url.pathname + url.search

        let priceReset = document.querySelector('.reset-price-container');
        priceReset.classList.remove('show')

        this.renderChangePage(searchUrl);
    }

    modifyFilters(event){
        this.renderChangePage(event.target.dataset.filterHref)
       
        let selectedProductCount = 0;
        let currentFilterCount = 0
        let hasSelectedFilter = 0;

        document.querySelectorAll('[data-filter-href]').forEach(value => {
            const productCount = Number(value.nextElementSibling.querySelector('[data-filter-count]').innerHTML)

            if(value.checked) {
                hasSelectedFilter++;
                selectedProductCount += productCount;
            }

            currentFilterCount += productCount;
        });

        if(hasSelectedFilter) {
            document.querySelector('.filter__mobile--current').innerText = selectedProductCount;
        } else {
            document.querySelector('.filter__mobile--current').innerText = currentFilterCount;
        }
    }

    setInputState(state){
        for(let e of document.querySelectorAll('[data-filter-href]')){ e.disabled = !state }
    }

    async renderChangePage(href){
        let container = document.querySelector('.shopify-section.row--product.product__list')
        container.style.opacity = '0.4'
        this.setInputState(false)
        
        let url = new URL(window.location.origin + href)
        let {html, json} = await this.basync.load({url, section: 'product-list', selector: '#shopify-section-product-list', json: 'noscript'})
        if(!html){
            this.setInputState(true)
            container.style.opacity = '1'
            return
        }
    
        container.innerHTML = html
        // document.getElementById('removeFilters').innerHTML = json.html

        history.pushState({}, '', window.location.origin + href);
        
        this.events.trigger('booster:content:update')
        container.style.opacity = '1';

        this.renderFilters(json)

        for(let c of document.querySelectorAll('.collection__total-items')){
            c.innerText = json.count
        }
        return
      }

    renderFilters(json){
    this.setInputState(true)

    for(let [k, v] of Object.entries(json.filters)){
        for(let f of v){
            let t = document.querySelector(`[data-filter="${k}-${f.value}"]`);
            if (t) {
                let c = t.nextElementSibling;
                if (c) {
                    let spanElement = c.querySelector('[data-filter-count]');
                    if (spanElement) spanElement.innerText = String(f.count);
                }
                t.disabled = !f.count;
                t.checked = f.active;
                t.dataset.filterHref = f.active ? f.urls.remove : f.urls.add;
                if (f.count) {
                    t.closest('div').classList.remove('filter--disabled');
                } else {
                    t.closest('div').classList.add('filter--disabled');
                }
            }
        }
    }
    }

    priceRangeFilterMin(event) {
        let priceMin = event.target.value;
        let url = new URL(window.location.href); 
        url.searchParams.delete('filter.v.price.gte');
        if(priceMin > 0) { 
            url.searchParams.append('filter.v.price.gte', priceMin); 
        }
        let href = url.pathname + url.search;
        this.checkReset()
        this.renderChangePage(href)
    }

    priceRangeFilterMax(event) {
        let priceMax = event.target.value;
        let url = new URL(window.location.href); 
        url.searchParams.delete('filter.v.price.lte');
        if(priceMax > 0) {
            url.searchParams.append('filter.v.price.lte', priceMax); 
        }
        let href = url.pathname + url.search;
        this.checkReset()
        this.renderChangePage(href)
    }

    checkReset() {
        let params = new URL(document.location).searchParams;
        let priceReset = document.querySelector('.reset-price-container');
        if(params.get('filter.v.price.lte') || params.get('filter.v.price.gte')) {
            priceReset?.classList.add('show')
        } else {
            priceReset?.classList.remove('show')
        }
    }
}

class BstrGDPR {
    constructor(id = 'bstr--notice'){
        this.container = document.getElementById(id);
        if(!this.container){
            return
        }
        this.closeButton = this.container.querySelector('[data-gdpr-accept]');
        if(this.closeButton) this.closeButton.addEventListener('click', this.close.bind(this));
        this.open(true)
    }

    open(check = false){
        if(!this.container){
            return console.info('[OPEN] GDPR container not found.')
        }

        if(check && bstore.get('bstr_gdpr')){
            return
        }

        return this.container.style.display = 'block'
    }

    close(){
        if(!this.container){
            return console.info('[CLOSE] GDPR container not found.')
        }

        bstore.set('bstr_gdpr', 'true', 43200);
        return this.container.style.display = 'none'
    }
}

class ProductTitleTruncate {
    constructor({ events, cardClass = '.card__title:not(.card__title--searched)' }) {
        this.events = events;
        this.cardClass = cardClass;
        this.initElements();
        this.events.on('booster:content:update', this.initElements.bind(this))
    }

    initElements() {
        this.handleHoverEvent()
    }

    handleHoverEvent() {
        const cardTitles = document.querySelectorAll(this.cardClass);

        if (cardTitles.length) {
            cardTitles.forEach(element => {
                element.addEventListener('mouseover', () => element.innerText = element.dataset.originalText);
                element.addEventListener('mouseout', () => element.innerText = element.dataset.truncatedText);
            });
        }
    }
}

class BstrEvents{
    constructor(){
        this.listeners = {}
        this.logs = {}
    }

    on(event, cb){
        if(typeof cb !== "function"){
            throw '[BOOSTER EVENT] Callback must be a function. Event: ' + event
        }

        if(this.logs[event]) cb.call(cb, this.logs[event])

        if(typeof this.listeners[event] === "undefined"){
            this.listeners[event] = [cb]
        } else {
            this.listeners[event].push(cb)
        }
    }

    trigger(event, params = {}, log = false){
        let cbs = this.listeners[event]
        let dom_prevented = document.dispatchEvent(new CustomEvent(event, {detail: params, cancelable: event.includes(':b*'), bubbles: true}))
        let rs = [dom_prevented]
        if(cbs && cbs.length){
            let prevented = !dom_prevented;
            for(let cb of cbs){
                try{
                    let r = cb.call(cb, {...params, prevented})
                    if(typeof r != "undefined"){
                        rs.push(r)
                        if(prevented !== true) prevented = r === false
                    }
                }catch(err){
                    console.info(`[BOOSTER EVENTS] Error caught on ${event}.\n${err}`)
                    continue;
                }                
            }
        }
        if(log) this.logs[event] = params
        return {values: rs, prevent: rs.includes(false)}
    }
}

class BstrIU{
    constructor({cfx, events, swatches}){
        this.cfx = cfx
        this.swatches = swatches
        this.events = events
        this.events.on('booster:variant:select', this.syncInputs.bind(this))
    }

    syncInputs(params){
        if(!params.selectedVariant.available) return
        let pid = params.product.id
        let vid = params.selectedVariant.id
        document.querySelectorAll(`[data-upsell-id="${pid}"]`).forEach((e)=>{
            if(e.tagName != "SELECT") return
            if(e.value == vid) return
            e.value = vid
        })
        this.toggleVariantIU()
    }

    toggleVariantIU(elem = false){
        let total = document.getElementById('inline-upsell__total')
        if(!total) return
        let stotal = document.getElementById('inline-upsell__discount')

        if(elem && elem.tagName == "SELECT"){
            let id = elem.dataset.upsellId;
            let variant = elem.value
            this.swatches.setProductVariant(id, variant)
        }

        let selected = document.querySelectorAll('input.inline-upsell__toggle:checked');
        let price = 0;
        let compare = 0;
        let elements = []
        let format = this.cfx.getFormat(Shopify.currency.active);
        for(let i = 0, maxi = selected.length; i < maxi; ++i){
            let input = document.getElementById(selected[i].dataset.for);
            let pprice = input.tagName == 'INPUT' ? parseInt(input.dataset.price) : parseInt(input.options[input.selectedIndex].dataset.price)
            let sprice = input.tagName == 'INPUT' ? parseInt(input.dataset.comparePrice) : parseInt(input.options[input.selectedIndex].dataset.comparePrice)
            let card = input.closestEl('.card--default')
            let cpprice = card.querySelector('[data-iu-price]')
            let csprice = card.querySelector('[data-iu-price-sale]')
            cpprice.innerHTML = this.cfx.formatMoney(pprice, format)
            elements.push(cpprice)
            if(sprice > pprice){
                csprice.parentElement.classList.add('card__price--sale')
                csprice.innerHTML = this.cfx.formatMoney(sprice, format)
                elements.push(csprice)
            } else {
                csprice.parentElement.classList.remove('card__price--sale')
                csprice.innerHTML = ''
            }
            price += pprice
            compare += sprice
        }
        total.innerHTML = this.cfx.formatMoney(price, format);
        stotal.innerHTML = compare > price ? this.cfx.formatMoney(compare, format) : ''
        elements.push(total, stotal)
        this.events.trigger('booster:price:update', {currency: Shopify.currency.active, elements})
    }
}

class BstrLazy{
    constructor({events, cname = 'lazyload'}){
      this.events = events
      this.class = cname;
      this.images = true;
      if ("loading" in HTMLImageElement.prototype && _settings.nativeLazyLoad) this.images = false
      this.init();
    }
  
    init(){
      if(!this.images) this.convertNative()

      this.observer = new IntersectionObserver((entries, self) => {
        for(let i = 0, maxi = entries.length; i < maxi; ++i){
          let entry = entries[i];
          if(entry.isIntersecting) {
            let t = entry.target;
            t.classList.remove('lazyload');
            t.classList.add('lazyloaded');
            switch(t.tagName){
              case "IMG":
                t.dataset.sizes ? t.sizes = t.dataset.sizes : null;
                t.dataset.src ? t.src = t.dataset.src : null;
                t.dataset.srcset ? t.srcset = t.dataset.srcset : null;
                break;
              case "DIV":
                if(t.dataset.bgset){
                  let width = window.innerWidth;
                  let bgset = t.dataset.bgset.split(',');
                  for(let i = 0, maxi = bgset.length; i < maxi; ++i){
                    let bg = bgset[i].split(' ')
                    let w = parseInt(bg[1]);
                    if(w >= width || i + 1 == bgset.length){
                      t.style.backgroundImage = `url(${bg[0]})`;
                      break;
                    }
                  }
                  break;
                }
                t.src = t.dataset.src;
                break;
              case "VIDEO":
                let v = t.querySelector('source');
                v.src = v.dataset.src;
                break;
              default:
                t.src = t.dataset.src;
                break;
            }
            self.unobserve(entry.target);
          }
        }
      }, {threshold: 0.05});

      if (_settings.easeIn){
        this.easeInObserver = new IntersectionObserver((entries, self) => {
            for (let i = 0, maxi = entries.length; i < maxi; ++i) {
              let entry = entries[i];
              if (entry.isIntersecting) {
                let t = entry.target;
                if (t.classList.contains('ease-in')) {
                  requestAnimationFrame(() => {
                    t.classList.remove('ease-in');
                    t.classList.add('eased-in');
                  });
                  self.unobserve(entry.target);
                }
              }
            }
        }, { threshold: 0.05 });
      }
  
      let lazyloads = this.images ? document.querySelectorAll(`.${this.class}`) : document.querySelectorAll(`.${this.class}:not([loading="lazy"])`);
      for(let i = 0, maxi = lazyloads.length; i < maxi; ++i){
        this.observer.observe(lazyloads[i]);
      }
      
      if (_settings.easeIn){
        let easeIns = document.querySelectorAll('.ease-in');
        for (let i = 0, maxi = easeIns.length; i < maxi; ++i) {
            this.easeInObserver.observe(easeIns[i]);
        }
      }
      
      this.events.on('booster:content:update', ()=>this.update())
    }

    convertNative(){
      var images = document.querySelectorAll('img[loading="lazy"]:not([data-bstr-initd])');
      for(let i = 0, maxi = images.length; i < maxi; ++i){
        let t = images[i];
        if(t.dataset.sizes) t.sizes = t.dataset.sizes;
        if(t.dataset.src) t.src = t.dataset.src;
        if(t.dataset.srcset) t.srcset = t.dataset.srcset;
        t.dataset.bstrInitd = "true"
      }
    }
  
    update() {
      if (!this.images) this.convertNative();
      let lazyloads = this.images ? document.querySelectorAll(`.${this.class}`) : document.querySelectorAll(`.${this.class}:not([loading="lazy"])`);
      for (let i = 0, maxi = lazyloads.length; i < maxi; ++i) {
        this.observer.observe(lazyloads[i]);
      }
      
      if (_settings.easeIn){
        let easeIns = document.querySelectorAll('.ease-in');
        for (let i = 0, maxi = easeIns.length; i < maxi; ++i) {
            this.easeInObserver.observe(easeIns[i]);
        }
      }
    }
  }
  
  

class BstrNotify{
    constructor({events}){
        this.events = events
        this.popupHolder = document.getElementById('booster__popup--holder')
        this.events.on('booster:notify', this.fn.bind(this))
    }

    fn(data){
        var self = this;
        var popup;
        if(data.url){
            popup = document.createElement('a')
            popup.href = data.url;
            popup.target = "_blank";
        } else {
            popup = document.createElement('div');
        }
        data.id ? popup.dataset.id = data.id : null;
        const removeThisFn = function(){
            if(this.dataset.id){
            let notifs = bstore.get('bstr_notifs') || {};
            let dismissed = notifs.dismissed || [];
            dismissed.push(this.dataset.id);
            notifs.dismissed = dismissed;
            bstore.set('bstr_notifs', notifs, 120);
            }
            this.parentElement.removeChild(this);
        };
        popup.setAttribute('class', 'booster__popup booster__popup--'+data.type);
        popup.innerText = typeof data.message == 'string' ? data.message : JSON.stringify(data.message);
        self.popupHolder.appendChild(popup);
        popup.onclick = removeThisFn;
        popup.classList.add('anim__fade-in');
        if(data.expires === false){
            return;
        }
        setTimeout(function(){
            try{
            self.popupHolder.removeChild(popup);
            } catch(err){}
        }, data.expires || 5000);
    }
}

class BstrRecentlyBought{
    constructor(){
      if(typeof recentlyBoughtConfig == 'undefined') return
      this.config = recentlyBoughtConfig
      this.container = document.getElementById('recently-bought--holder')
      this.init()
    }
  
    async init(){
      let showEvery = _settings.recentlyBoughtInterval;
      let displayFor = _settings.recentlyBoughtRemain;
      let data = await fetch(this.config.allProductsUrl + '?section_id=api__recently-bought');
      let raw = await data.text();
      let parser = document.createElement('div');
      parser.innerHTML = raw;
      let parsed = JSON.parse(parser.querySelector('.shopify-section').innerText);
      parsed.names = parsed.names.split(',');
      parsed.names = parsed.names.filter(name=>name.trim()!='');
      if(!parsed.names.length) parsed.names = 'Alissa Ashford, Carroll Calley, Augustina Angulo, Kenna Kuntz, Hailey Hinkle, Breann Beckham, Raquel Roles, Bernetta Beeks'.split(',')
      this.recentlyBoughtCollection = parsed;

      if (_settings.showEveryUnit == 'minutes') {
        showEvery *= 60;
      }

      if (_settings.displayForUnit == 'minutes') {
        displayFor *= 60;
      }
      this.render()

      setInterval(() => this.render(), (showEvery + displayFor) * 1000);
    }
  
    render(){
      let displayFor = _settings.recentlyBoughtRemain;
        
      if (_settings.displayForUnit == 'minutes') {
        displayFor *= 60;
      }
      const RBC = this.container;
      const $rb = (q)=>RBC.querySelector(q)
  
      let img = $rb('.recently-bought--img img');
      let person = $rb('.recently-bought--who');
      let time = $rb('.recently-bought--when');
      let title = $rb('.recently-bought--what');
      let price = $rb('.recently-bought--price');
  
      let names = this.recentlyBoughtCollection.names;
      let products = this.recentlyBoughtCollection.collection;
  
      let product = products[getRandomInt(0, products.length - 1)];
      let name;
      if(this.config.useNames){
        name = names[getRandomInt(0, names.length - 1)].trim();
        if(this.config.nameFormat == 'shorten'){
          let sname = name.split(' ');
          name = sname.length == 1 ? sname[0] : `${sname[0]} ${sname[1][0]}.`;
        } else if(this.config.nameFormat == 'initials'){
          name = name.split(' ').reduce((n, e)=>{n += `${e[0]}. `; return n}, '')
        }
      } else {
        name = _bstrLocale.recentlyBought.someone
      }
  
      img.src = product.image;
      title.innerText = product.title.slice(0, 24);
      price.querySelector('.current-price').innerText = product.priceFormat;
      price.querySelector('.old-price').innerText = product.sale ? product.discountPriceFormat : '';
      person.innerText = _bstrLocale.recentlyBought.purchased.replace('%name%', name);
      time.innerText = _bstrLocale.recentlyBought.ago.replace('%time%', getRandomInt(2, 50))
      RBC.href = product.url;
  
      const image_ratio = $rb('.recently-bought--img-ratio')
      if(!image_ratio.dataset.widthAdjusted){
        image_ratio.style.width = RBC.clientHeight + 'px';
        image_ratio.dataset.widthAdjusted = "true";
      }
      RBC.classList.add('anim__fade-in');
  
      setTimeout(()=>{
        RBC.classList.remove('anim__fade-in')
      }, displayFor * 1000);
    }
}

class BstrSlider {
    constructor({
        events,
        selector,
        breakpoints
    } = {}) {
        this._selector = selector || '[data-bstr-slider]';
        this._idSelector = this._selector.replace(/(\[data-|\])/g, '').replace(/-(\w)/g, (s)=>s[1].toUpperCase())
        this._breakpoints = breakpoints || {
            sm: 768,
            md: 1024
        }
        this._sliders = {};
        this._currentIndex = 0;
        this._resize = false
        this.init();
        events.on('booster:content:update', ()=>this.init())
    }

    _isVisible(s_rect, c_rect, vertical) {
        if (vertical) {
            return c_rect.top - s_rect.top <= 0 && c_rect.bottom - s_rect.bottom >= 0;
        } else {
            return c_rect.left - s_rect.left <= 0 && c_rect.right - s_rect.right >= 0
        }
    }

    async _parentMoveCallback(slider) {
        let previous = parseInt(slider.dataset.bstrSliderCurrent)
        const vertical = slider.dataset.bstrSliderOrientation.toLowerCase() == "vertical"
        if(!slider.querySelector('[data-bstr-slide]')) return
        let current = vertical ? Math.round(slider.scrollTop / slider.querySelector('[data-bstr-slide]').offsetHeight) : slider.scrollLeft != 0 ? Math.round(slider.scrollLeft / slider.querySelector('[data-bstr-slide]').offsetWidth) : 0
        slider.dataset.bstrSliderCurrent = current
        let direction = previous - current > 0 ? '+' : '-'

        let s_children = slider.querySelectorAll('[data-bstr-slide]')
        let parray = []
        let carray = []

        const s_rect = slider.closest('[data-bstr-slide-holder]').getBoundingClientRect()
        for (let i = 0; i < s_children.length; ++i) {
            let child = s_children[i]
            if (this._isVisible(s_rect, child.getBoundingClientRect(), vertical)) {
                child.dataset.bstrSlide = "active"
                carray.push({
                    index: i,
                    target: child
                })
            } else if (child.dataset.bstrSlide == "active") {
                child.dataset.bstrSlide = ""
                parray.push({
                    index: i,
                    target: child
                })
            }
        }

        this._moveCallback && this._moveCallback({
            direction,
            slider,
            current: carray,
            previous: parray
        })
    }

    init(selector = false) {
        let sliders = document.querySelectorAll(`${selector || this._selector}:not([data-bstr-initd])`);
        for (let sliderComponent of sliders) {
            let slider = sliderComponent.querySelector('[data-bstr-slide-holder]');
            let id;
            if (sliderComponent.dataset[this._idSelector]) {
                id = sliderComponent.dataset[this._idSelector]
            } else {
                id = ++this._currentIndex
                sliderComponent.dataset[this._idSelector] = id
            }
            sliderComponent.setAttribute('data-bstr-initd', 'true')
            slider.dataset.bstrSliderId = id;

            let viewports = slider.dataset.bstrSlideHolder.split('|')
            if (viewports.length == 3) {
                this._sliders[id] = {
                    lg: parseInt(viewports[0]),
                    md: parseInt(viewports[1]),
                    sm: parseInt(viewports[2])
                }
            } else {
                let parsed = parseInt(viewports[0])
                this._sliders[id] = isNaN(parsed) ? {
                    lg: 1,
                    md: 1,
                    sm: 1
                } : {
                    lg: parsed,
                    md: parsed,
                    sm: parsed
                }
            }

            let buttons = [...sliderComponent.querySelectorAll('[data-bstr-slider-button]'), ...document.querySelectorAll(`[data-bstr-slider-button][data-bstr-for-slider="${id}"]`)]
            for (let button of buttons) {
                button.addEventListener('click', (e) => {
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    this._move({
                        slider,
                        direction: button.dataset.bstrSliderButton || '+'
                    })
                });
            }
            
            // Checks if auto play is enabled
            if(slider.dataset.bstrAutoplay == "true") {
                const slideSpeed = slider.dataset.bstrSlideSpeed;
                this._autoplayHandler({
                slider,
                slideSpeed
                })
            }

            this._parentMoveCallback(slider)
            slider.addEventListener('scroll', debounce(() => this._parentMoveCallback(slider), 100), {
                passive: true
            })
        }

        if (this._resize) return
        this._resizeHandler();
        window.addEventListener('resize', debounce(this._resizeHandler.bind(this), 250), {
            passive: true
        });
        this._resize = true
    }

    _autoplayHandler({slider, slideSpeed}) {
        setInterval(() => {
            this._move({
                slider,
                direction:'+'
            })
        }, slideSpeed);
    }

    _resizeHandler() {
        if (window.innerWidth < this._breakpoints.sm) {
            this.viewport = 'sm'
        } else if (window.innerWidth < this._breakpoints.md) {
            this.viewport = 'md'
        } else {
            this.viewport = 'lg'
        }

        this.rawViewport = window.innerWidth;
    }

    _moveTo({
        index = 0,
        slider
    }) {
        let current = parseInt(slider.dataset.bstrSliderCurrent);
        let vertical = slider.dataset.bstrSliderOrientation.toLowerCase() == "vertical";
        let s_children = slider.querySelectorAll('[data-bstr-slide]');
        if(!s_children.length) return
        current = Math.max(Math.min(index, s_children.length - 1), 0)

        vertical ? slider.scrollTo(0, s_children[current].offsetTop - slider.offsetTop) : slider.scrollTo(s_children[current].offsetLeft - slider.offsetLeft - parseInt(window.getComputedStyle(slider).paddingLeft), 0)
    }

    _moveThumbTo({
        index = 0,
    }) {
        const width = screen.width;
        const target = document.querySelector(`[data-bstr-slider-thumb='${index}']`);

        if(width > 767)
            target.parentNode.scrollTop = target.offsetTop;
        else
            target.parentNode.scrollLeft = target.offsetLeft;
    }

    _move({
        direction,
        slider
    }) {
        let moveBy = this._sliders[slider.dataset.bstrSliderId][this.viewport];
        let current = parseInt(slider.dataset.bstrSliderCurrent);
        let previous = current;
        let vertical = slider.dataset.bstrSliderOrientation.toLowerCase() == "vertical";
        let s_children = slider.querySelectorAll('[data-bstr-slide]');
        if(!s_children.length) return
        let offset = vertical ? Math.round(1 / (s_children[0].offsetHeight / slider.offsetHeight)) : Math.round(1 / (s_children[0].offsetWidth / (slider.offsetWidth - parseInt(window.getComputedStyle(slider).paddingLeft))));

        current = direction === "+" ? Math.min(current + moveBy, s_children.length - offset) : Math.max(current - moveBy, 0)

        // check if loop works
        if(slider.dataset.bstrSlideLoop){
            if(current === previous){
                if(direction === "-"){
                    current = s_children.length - offset
                }else{
                    current = 0
                }
            }
        }

        vertical ? slider.scrollTo(0, s_children[current].offsetTop - slider.offsetTop) : slider.scrollTo(s_children[current].offsetLeft - slider.offsetLeft - parseInt(window.getComputedStyle(slider).paddingLeft), 0)
    }
}

class BstrCarousel {
    constructor() {
        this._options = {};
        this.init();
    }

    init() {
        document.querySelectorAll("[data-bstr-carousel]").forEach(section => {
            if (section.hasAttribute('data-bstr-thumbs-carousel')) {
                // carousel is thumbnail
                // https://swiperjs.com/demos#thumbs-gallery

                const thumbSwiper = section.querySelector(".thumbs-swiper");
                const mainSwiper = section.querySelector(".main-swiper");
                const prevButton = section.querySelector("[data-bstr-carousel-button-prev]");
                const nextButton = section.querySelector("[data-bstr-carousel-button-next]");

                let options1 = {}

                const selector1Options = thumbSwiper.dataset.bstrCarouselOptions ? JSON.parse(thumbSwiper.dataset.bstrCarouselOptions) : {};
                options1 = { ...options1, ...selector1Options }; 

                var thumbSwipers = new Swiper(thumbSwiper, options1);

                let options2 = {
                    navigation: {
                        nextEl: nextButton,
                        prevEl: prevButton,
                    }
                }

                const selector2Options = mainSwiper.dataset.bstrCarouselOptions ? JSON.parse(mainSwiper.dataset.bstrCarouselOptions) : {};
                options2 = { ...options2, ...selector2Options }; 

                var mainSwipers = new Swiper(mainSwiper, options2);

                let isSyncing = false;

                thumbSwipers.on('realIndexChange', function () {
                    if (isSyncing) return;
                    isSyncing = true;
                    const realIndex = this.realIndex;
                    mainSwipers.slideToLoop(realIndex);
                    isSyncing = false;
                });

                mainSwipers.on('realIndexChange', function () {
                    if (isSyncing) return;
                    isSyncing = true;
                    const realIndex = this.realIndex;
                    thumbSwipers.slideToLoop(realIndex);
                    isSyncing = false;
                });
            } else {
                // single carousel only

                const selector = section.querySelector("[data-bstr-carousel-items]");
                const prevButton = section.querySelector("[data-bstr-carousel-button-prev]");
                const nextButton = section.querySelector("[data-bstr-carousel-button-next]");
                const pagination = section.querySelector("[data-bstr-carousel-pagination]");
                this._options = {
                    navigation: {
                        nextEl: nextButton,
                        prevEl: prevButton,
                    },
                    pagination: {
                        el: pagination,
                        clickable: true
                    }
                };
                
                const sectionOptions = section.dataset.bstrCarouselOptions ? JSON.parse(section.dataset.bstrCarouselOptions) : {};
                this._options = { ...this._options, ...sectionOptions };
                
                if (selector) {
                    new Swiper(selector, this._options);
                }
            }
        }); 
    }
}

class ProductSlider extends BstrSlider {
    constructor(props) {
        super(props)
        this.initThumbs()
        props.events.on('booster:content:update', this.initThumbs)
    }

    initThumbs(){
        let thumbs = document.querySelectorAll('[data-bstr-slider-thumb]:not([data-bstr-initd])')
        for(let thumb of thumbs){
            let sid = thumb.dataset.bstrSliderFor;
            let slider = sid ? document.querySelector(`[data-bstr-ppslider="${sid}"] [data-bstr-slide-holder]`) : thumb.closest('[data-bstr-ppslider]')
            let index = parseInt(thumb.dataset.bstrSliderThumb)
            thumb.addEventListener('click', ()=>super._moveTo({slider, index}))
            if(thumb.getAttribute('data-bstr-slider-thumb-hover') != null) thumb.addEventListener('mouseover', ()=>super._moveTo({slider, index}))
        }
    }

    _moveCallback({slider, current}) {
        if(!current.length) return

        let id = slider.dataset.bstrSliderId

        for(let th of document.querySelectorAll(`.bstrSlider__thumb--active[data-bstr-slider-for="${id}"]`)){
            th.classList.remove('bstrSlider__thumb--active')
        }

        // only when thumbnail on bottom and setting turned on (otherwise, make image object-fit: contain and fixed max-height)
        if(window.innerWidth < 790){
            let max = 0;
            for(let c of current){
                let ch = c.target.children[0]
                if(!ch) continue
                if(ch.clientHeight > max) max = ch.clientHeight
            }
            if(max) slider.closest('[data-bstr-ppslider]').style.maxHeight = `${max}px`
        } else {
            slider.closest('[data-bstr-ppslider]').style.maxHeight = null
        }

        document.querySelector(`[data-bstr-slider-thumb="${current[0].index}"][data-bstr-slider-for="${id}"]`).classList.add('bstrSlider__thumb--active')
    }
}

class BstrSectionSlider extends BstrSlider{
    constructor(props){
        super(props)
    }

    _moveCallback(params){
        for(let {target} of params.previous){
            let slide = target.dataset.type == "bannerSlider" ? target.querySelector('div'): target;
            if(slide.dataset.type == "video") slide.querySelector('video').pause()
            slide.classList.remove('slide__animation')
        }

        for(let {target} of params.current){
            let slide = target.dataset.type == "bannerSlider" ? target.querySelector('div'): target
            if(slide.dataset.type == "video") slide.querySelector('video').play()
            slide.classList.add('slide__animation')
        }
    }
}

class BstrStock{
    constructor({events}){
        this.events = events
        this.stockInterval
        this.initStock()
        this.events.on('booster:content:update', this.initStock.bind(this))
    }

    async initStock() {
        if (this.stockInterval) {
        clearInterval(this.stockInterval);
        }
        let holders = document.querySelectorAll('[data-stock-type]');
        if (!holders.length) {
        return;
        }
        let cookie = bstore.get('bstrStock') || {};
        let managed = [];
        let reduce = parseInt(holders[0].dataset.reduce);
        if (holders[0].dataset.stockType == 'inventory' || cookie['stockInfo'] != holders[0].dataset.stockType) {
        cookie = {
            stockInfo: holders[0].dataset.stockType
        };
        }
        for (let i = 0, maxi = holders.length; i < maxi; ++i) {
        let item = holders[i];
        let stock;
        if (cookie[item.dataset.product]) {
            stock = cookie[item.dataset.product];
            managed.push(item);
        } else {
            if (item.dataset.stockType == 'inventory') {
            stock = item.dataset.stockLeft;
            } else {
            stock = getRandomInt(item.dataset.stockLeft / 10, item.dataset.stockLeft);
            cookie[item.dataset.product] = stock;
            managed.push(item);
            }
        }
        if (item.dataset.stockType == 'inventory') {
            item.closestEl('.amount--left').style.width = getRandomInt(5, 25) + '%';
        } else {
            let width = Math.floor(stock / item.dataset.stockLeft * 100 * 0.25);
            if (width < 5) {
            width = 5;
            }
            item.closestEl('.amount--left').style.width = width + '%';
        }
        item.innerText = stock;
        }
        bstore.set('bstrStock', cookie, 1440);
        if (reduce > 0) {
        var self = this;
        this.stockInterval = setInterval(() => {
            self.stockManagement(managed);
        }, reduce * 1000);
        }
    }
    
    stockManagement(holders) {
        let cookie = bstore.get('bstrStock') || {};
        for (let i = 0, maxi = holders.length; i < maxi; ++i) {
        let item = holders[i];
        let stock = parseInt(item.innerText);
        if (stock > 1) {
            --stock;
        }
        cookie[item.dataset.product] = stock;
        let width = Math.floor(stock / item.dataset.stockLeft * 100 * 0.25);
        if (width < 5) {
            width = 5;
        }
        item.closestEl('.amount--left').style.width = width + '%';
        item.innerText = stock;
        }
        bstore.set('bstrStock', cookie, 1440);
    }  
}

class BstrSwatches {
    constructor({events, slider, cfx}) {
        this.events = events
        this.current = {}
        this.variants = {}
        this.THEME_UTILS = new BstrSwatchesTheme({swatches: this, events, slider, cfx})

        this.initListeners()
        this.events.on('booster:content:update', ()=>{
            this.initListeners()
            for(let k of Object.keys(this.current)){
                this.filterSwatches(k)
            }
        })
    }

    initListeners(){
        const self = this;
        let swatches = document.querySelectorAll('[data-swatch-index]:not([data-booster-initd])')
        for(let swatch of swatches){
            if(swatch.tagName == 'OPTION') continue
            if(swatch.tagName === 'SELECT'){
                swatch.addEventListener('change', (event)=>{
                    let t = event.currentTarget
                    let v = t.value
                    let pi = t.dataset.swatchIndex.trim().split('-')
                    let swatchOption;
                    if(v === 'bstrSelectNill'){
                        swatchOption = false
                    }else{
                        swatchOption = v
                    }
                    self.setOption(pi[0], parseInt(pi[1]), swatchOption)
                })
            }else{
                swatch.addEventListener('click', (event)=>{
                    let t = event.currentTarget
                    if(_settings.swatchLogic != "amazon" && t.classList.contains('swatch--disabled')) return
                    if(_settings.disableSOSwatch && t.dataset.swatchSoldout) return
                    let pi = t.dataset.swatchIndex.trim().split('-')
                    let swatchOption;
                    if(t.classList.contains('swatch--active')){
                        swatchOption = false
                    } else {
                        swatchOption = swatch.dataset.swatchOption
                    }
                    self.setOption(pi[0], parseInt(pi[1]), swatchOption)
                })
            }
            swatch.dataset.boosterInitd = 'true'
        }

        if(_settings.preselectSwatch != "false"){
            let variants = document.querySelectorAll('noscript[data-bstr-preselect]:not(data-bstr-initd)')
            if(_settings.preselectSwatch == "firstOptionIndex"){
                for(let nos of variants){
                    nos.dataset.bstrInitd = "true"
                    // if(Object.keys(this.current).includes(nos.dataset.bstrSwatch)) continue
                    this.setOption(nos.dataset.bstrSwatch, 0, this.getVariant(nos.dataset.bstrSwatch, nos.dataset.bstrPreselect).options[0])
                }
            }else{
                for(let nos of variants){
                    nos.dataset.bstrInitd = "true"
                    // if(Object.keys(this.current).includes(nos.dataset.bstrSwatch)) continue
                    this.setProductVariant(nos.dataset.bstrSwatch, nos.dataset.bstrPreselect)
                }
            }
        }
    }

    getVariants(pid){
        if(!this.variants[pid]){
            this.variants[pid] = JSON.parse(document.querySelector(`noscript[data-bstr-swatch="${pid}"]`).innerText)
        }

        return this.variants[pid]
    }

    getVariant(pid, id){
        return this.getVariants(pid)[id]
    }

    findVariant(pid){
        const current = this.current[pid]
        const variants = this.getVariants(pid)
        for(let [k, v] of Object.entries(variants)){
            let f = true
            for(let i = 0; i < current.length; ++i){
                if(current[i] === false) continue
                if(v.options[i] !== current[i]){
                    f = false
                    break
                }
            }
            if(f) return k
        }
        return false
    }

    dropCombination(pid, idx){
        const variants = this.getVariants(pid)
        const v_values = Object.values(variants)
        const current = [...this.current[pid]]
        let aoptions = this.genArray(()=>[], 0, current.length)

        let nidx;
        for(let i = 0; i < current.length; ++i){
            if(current[i] === false || i === idx) continue
            nidx = i
            break
        }

        for(let {options} of v_values){
            if(options[idx] != current[idx]) continue
            for(let j = 0; j < options.length; ++j){
                aoptions[j].push(options[j])
            }
        }

        for(let i = 0; i < aoptions.length; ++i){
            if(i === idx) continue
            if(!aoptions[i].includes(this.current[pid][i])) this.current[pid][i] = false
        }

        if(JSON.stringify(current) === JSON.stringify(this.current[pid])){
            this.current[pid][nidx] = false
            if(!this.findVariant(pid)) return this.dropCombination(pid, idx)
        }
    }

    validateOptions(pid, changeOptions, i){
        let ov = this.findVariant(pid)
        let selected = false
        if(typeof ov !== "boolean"){
            selected = ov
        }

        this.current[pid] = changeOptions
        let mv = this.findVariant(pid)

        if(mv === false){
            if(_settings.swatchLogic === "amazon"){
                this.dropCombination(pid, i)
            }
            this.events.trigger('booster:swatch:update', {selectedVariant: false, currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
            if(selected !== false) this.events.trigger('booster:variant:deselect', {oldVariant: selected, currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
        }else{
            if(this.current[pid].includes(false)) {
                this.events.trigger('booster:swatch:update', {selectedVariant: false, currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
                if(selected !== false) this.events.trigger('booster:variant:deselect', {oldVariant: selected, currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
            }else{
                this.events.trigger('booster:swatch:update', {selectedVariant:this.getVariant(pid, mv), currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
                this.events.trigger('booster:variant:select', {selectedVariant: this.getVariant(pid, mv), currentOptions: this.current[pid], product: {id: pid, variants: this.getVariants(pid)}})
            }
        }

        this.filterSwatches(pid)
    }

    setOption(pid, i, o) {
        if (!this.current[pid]) {
            this.current[pid] = new Array(Object.values(this.getVariants(pid))[0].options.length).fill(false)
        }

        let changeOptions = [...this.current[pid]]
        changeOptions[i] = o
        this.validateOptions(pid, changeOptions, i)
    }

    setOptions(pid, arr) {
        if (!this.current[pid]) {
            this.current[pid] = new Array(Object.values(this.getVariants(pid))[0].options.length).fill(false)
        }

        this.validateOptions(pid, [...arr], 0)
    }

    setProductVariant(pid, id) {
        const variant = this.getVariant(pid, id)
        this.setOptions(pid, variant.options)
    }

    genArray(gf, s, e){
        let a = []
        for(let i = s; i < e; ++i){
            a[i] = gf.call()
        }
        return a
    }

    matchesOptions(c, options){
        for(let i = 0; i < options.length; ++i){
            if(c[i] === false) continue
            if(c[i] != options[i]) return false
        }
        return true
    }

    filterSwatches(pid) {       
        const variants = this.getVariants(pid)
        const current = this.current[pid]
        let aVars = current.length

        let aOptions = this.genArray(()=>new Set(), 0, aVars)
        for(let v of Object.values(variants)){
            for(let i = 0; i < aVars; ++i){
                aOptions[i].add(v.options[i])
            }
        }

        for(let i = 0; i < current.length; ++i){
            let tOpts = this.genArray(()=>new Set(), 0, aVars)
            let cm = [...current]
            cm[i] = false
            for(let {options} of Object.values(variants)){
                if(this.matchesOptions(cm, options)){
                    for(let j = 0; j < aVars; ++j){
                        tOpts[j].add(options[j])
                    }
                }
            }

            aOptions[i] = new Set([...aOptions[i]].filter(v => tOpts[i].has(v)))
        }

        return this.events.trigger('booster:swatch:render', {pid, options: current, aOptions})
    }
}

class BstrSwatchesTheme{
    constructor({swatches, events, slider, cfx}){
        this.sw = swatches
        this.cfx = cfx
        this.slider = slider
        this.events = events
        this.initEvents()
    }

    initEvents(){
        this.events.on('booster:variant:select', this.selectSwatch.bind(this))
        this.events.on('booster:variant:deselect', this.deselectSwatch.bind(this))
        if(_settings.variantShowImage) this.events.on('booster:swatch:update', this.scrollToImage.bind(this))
        this.events.on('booster:swatch:render', this.renderSwatches.bind(this))
    }

    renderSwatches({pid, options, aOptions}){
        for (let i = 0; i < aOptions.length; ++i) {
            let os = document.querySelectorAll(`[data-swatch-index="${pid}-${i}"]`)
            for (let o of os) {
                if(o.tagName == "OPTION"){
                    if (!aOptions[i].has(o.value)) {
                        o.setAttribute('disabled', 'true')
                    } else {
                        o.removeAttribute('disabled')
                    }
                }else if(o.tagName !== "SELECT"){
                    if (!aOptions[i].has(o.dataset.swatchOption)) {
                        o.classList.add('swatch--disabled')
                    } else {
                        o.classList.remove('swatch--disabled')
                    }
                }
            }
        }
    
        for(let e of document.querySelectorAll(`.swatch--active[data-swatch-index^="${pid}"]`)){
            e.classList.remove('swatch--active')
        }
    
        for(let i = 0; i < options.length; ++i){
            if(options[i] === false){
                document.querySelectorAll(`span[data-swatch-selected-name="${pid}-${i}"]`).forEach(e=>e.innerText = '')
                document.querySelectorAll(`select[data-swatch-index="${pid}-${i}"]`).forEach(e=>e.value = 'bstrSelectNill')
            } else {
                document.querySelectorAll(`span[data-swatch-selected-name="${pid}-${i}"]`).forEach(e=>e.innerText = ' - ' + options[i])
            }
        }
    
        let actives = []
    
        for(let i = 0; i < options.length; ++i){
            if(options[i] === false) continue
            actives.push(...document.querySelectorAll(`[data-swatch-option="${CSS.escape(options[i])}"][data-swatch-index="${pid}-${i}"]`))
            actives.push(...document.querySelectorAll(`option[value="${CSS.escape(options[i])}"][data-swatch-index="${pid}-${i}"]`))
        }
    
        for(let e of actives){
            if(e.tagName == "OPTION"){
                e.closest('select').value = e.value
            }else{
                e.classList.add('swatch--active')
            }
        }
    }

    scrollToImage(params){
        let queryString = ''
        const initial = params.currentOptions.length
        let marker = new Array(initial * 2).fill('#')
        marker[0] = "|"
        marker[initial * 2 - 1] = "|"
        let operator = new Array(initial).fill('*')
        operator[0] = "^"
        operator[initial - 1] = "$"
        if(params.currentOptions.some((e)=>e !== false)){
            if(!params.currentOptions.includes(false)){
                let qs = ''
                for(let i = 0; i < initial * 2; i += 2){
                    qs += `${marker[i]}${CSS.escape(params.currentOptions[i / 2])}${marker[i + 1]}`
                }
                if(!params.selectedVariant.isCardSwatches) {
                    queryString = `[data-variants*="${qs}"]`.replace(/##/g, '#')
                  } else {
                     queryString = `[data-card-product-id="${params.product.id}"][data-variants*="${qs}"]`.replace(/##/g, '#')
                 }
            } else {
                for(let i = 0; i < initial * 2; i += 2){
                    if(params.currentOptions[i / 2] === false) continue
                    queryString += `[data-variants${operator[i / 2]}="${marker[i]}${CSS.escape(params.currentOptions[i / 2])}${marker[i + 1]}"]`
                }
            }

            let elem = document.querySelector(queryString)
            if(elem){
                let parent = elem.closest('[data-bstr-slide-holder]')
                let index = Array.from(parent.children).indexOf(elem)
                this.slider._moveTo({index, slider: parent})
                this.slider._moveThumbTo({index})
            }
        }
    }

    selectSwatch(params){
        let pid = params.product.id
        let price = params.selectedVariant.price
        let variant = params.selectedVariant
        let elems = document.querySelectorAll(`[data-product-price="${pid}"], [data-product-price-sale="${pid}"]`)

        // Changes the sku value upon selecting swatch option
        let skuElem = document.querySelector('.product-page--sku');
        
        if(skuElem && variant.sku) skuElem.innerText = variant.sku

        let sale = variant.sale_raw

        elems.forEach((e)=>{
            e.innerText = price
            if(sale){
                e.classList.add('product__price--sale')
            } else {
                e.classList.remove('product__price--sale')
            }
        })
        
        document.querySelectorAll(`[data-tag-product="${pid}"]`).forEach((e)=>{
            let type = sale ? e.dataset.tagType : false
            switch(type){
                case 'percent':{
                    e.innerText = Math.floor((variant.price_raw - variant.sale_raw) / variant.sale_raw * 100) + '% ' + _bstrLocale.tags.off
                    break;
                }
                case 'amount':{
                    e.innerText = this.cfx.formatMoney(variant.sale_raw - variant.price_raw, this.cfx.getFormat())
                    break;
                }
                case 'text':{
                    e.innerText = _bstrLocale.tags.sale.toUpperCase()
                    break;
                }
                default:{
                    e.classList.add('hide')
                    break;
                }
            }

            if(type) e.classList.remove('hide')
        })
        
        document.querySelectorAll(`[data-product-price-sale="${pid}"]`).forEach((e)=>{
            if(!sale) return e.classList.add('hide')
            e.innerText = variant.sale
            e.classList.remove('hide')
        })

        let inps = document.querySelectorAll(`input[data-bstr-variant-input="${params.product.id}"]`)
        for(let input of inps){
            input.setAttribute('value', params.selectedVariant.id)
        }

        let buttons = document.querySelectorAll(`[data-buy-button="${params.product.id}"]`)
        for(let btn of buttons){
            if(variant.available){
                btn.querySelector('[data-button-text]').innerText = btn.dataset.originalText
                btn.removeAttribute('disabled')
            } else {
                btn.querySelector('[data-button-text]').innerText = _bstrLocale.buttons.sold_out
                btn.setAttribute('disabled', 'true')
            }
        }

        let dynbuttons = document.querySelectorAll(`[data-dynamic-button="${params.product.id}"]`)
        for(let btn of dynbuttons){
            let b = btn.querySelector('button')
            btn.classList.remove('disabled')
            if(!b) continue
            if(variant.available){
                b.removeAttribute('disabled')
            } else {
                b.setAttribute('disabled', 'true')
            }
        }

        if(!params.selectedVariant.isCardSwatches)  {
            let url = new URL(document.URL)
            url.searchParams.set('variant', params.selectedVariant.id)
            history.replaceState({}, '', url)
        } else {
            let productHandleSelector = `[data-product-card-swatch-id='${params.product.id}']`
            let productElem = document.querySelectorAll(productHandleSelector);

            productElem.forEach((e)=>{
                e.href = params.selectedVariant.variant_url
            })
        }

        this.events.trigger('booster:price:update', {elements: elems})
    }

    deselectSwatch(params){
        let inps = document.querySelectorAll(`input[data-bstr-variant-input="${params.product.id}"]`)
        for(let input of inps){
            input.setAttribute('value', -1)
        }

        let buttons = document.querySelectorAll(`[data-buy-button="${params.product.id}"]`)
        for(let btn of buttons){
            btn.setAttribute('disabled', 'true')
            btn.querySelector('[data-button-text]').innerText = _bstrLocale.buttons.select
        }

        let dynbuttons = document.querySelectorAll(`[data-dynamic-button="${params.product.id}"]`)
        for(let btn of dynbuttons){
            let b = btn.querySelector('button')
            if(!b) continue
            b.setAttribute('disabled', 'true')
        }
        
        let url = new URL(document.URL)
        url.searchParams.delete('variant')
        history.replaceState({}, '', url)
    }

}

class BstrVisitor{
    constructor({events, basync, geo = true}){
        this.events = events
        this.geo = geo
        this.basync = basync
        this.customer = false
        this.map = {
          '%country%': {
            k: 'country',
            sk: 'name'
          },
          '%city%': {
            k: 'city',
            sk: 'name'
          },
          '%zip%': {
            k: 'city',
            sk: 'zip'
          },
          '%flag_svg%': {
            k: 'flag',
            sk: 'svg'
          },
          '%flag_emoji%': {
            k: 'flag',
            sk: 'emoji'
          },
          '%language_name%': {
            k: 'language',
            sk: 'name'
          },
          '%language_native%': {
            k: 'language',
            sk: 'nativeName'
          },
          '%language_code%': {
            k: 'language',
            sk: 'code'
          },
          '%currency_code%': {
            k: 'currency',
            sk: 'code'
          },
          '%currency_name%': {
            k: 'currency',
            sk: 'name'
          },
          '%currency_symbol%': {
            k: 'currency',
            sk: 'symbol'
          }
        }
        this.init()
    }

    replaceContent(block){
      let it = block.dataset.bstrGeoBlock == "" ? block.innerHTML : block.dataset.bstrGeoBlock
      for(let [k, v] of Object.entries(this.map)){
        it = it.replace(new RegExp(k, 'gi'), v.sk ? this.customer[v.k][v.sk] : this.customer[v.k])
      }
      block.innerHTML = it
    }

    embedGeo(){
      let gblock = document.querySelectorAll('[data-bstr-geo-block]:not([data-bstr-initd])')
      for(let block of gblock){
        this.replaceContent(block)
        block.dataset.bstrInitd = "true"
        block.removeAttribute('data-bstr-geo-block')
      }
    }

    async init(){
      if(bstore.get('bstr:visitor_info')){
        this.customer = bstore.get('bstr:visitor_info')
        this.embedGeo()
        this.events.on('booster:content:update', this.embedGeo.bind(this))
        return this.events.trigger('booster:geo:visitor', this.customer, true)
      } 

      const r = await fetch('https://js.instantgeo.info/json');
      if(!r.ok) this.events.trigger('booster:geo:error')

      const { country: countryCode, city, postalCode: zip = "00000", ip = "0.0.0.0" } = r.ok ? await r.json() : { country: "US", city: "Washington, D.C." }
      const sectionUrl = new URL(window.location)
      sectionUrl.pathname = bstri18n.all_products_route
      sectionUrl.searchParams.set("sort_by", (countryCode || "US"))

      const { json } = await this.basync.load({ url: sectionUrl, section: "countries", json: "div#countries-json" });
      if(!json) return this.events.trigger('booster:geo:error');
      
      let { capital, region, name, nativeName, currency, languages, flag, emoji } = json

      const ml = languages[0]
      let languageCode = ml['iso639_1'].toLowerCase();

      /* Variation codes patch, missing Chinese */
      switch (countryCode){
        case 'BR':{
          languageCode = 'pt-br'
          break;
        }
        case 'PT':{
          languageCode = 'pt-pt'
          break;
        }
      }

      this.customer = {
          ip,
          country: {
              code: countryCode,
              name,
              nativeName,
              capital
          },
          region,
          city: {
              name: city,
              zip,
              capital: capital.toLowerCase() == city.toLowerCase()
          },
          language: {
              code: languageCode,
              name: ml.name,
              nativeName: ml.nativeName
          },
          currency,
          flag: {
              svg: `<img src="${flag}" style="height: 1em">`,
              emoji: emoji.split(' ').reduce((a, v)=>{a += String.fromCodePoint(parseInt(v, 16)); return a}, '')
          }
      }

      bstore.set('bstr:visitor_info', this.customer, 180)
      this.embedGeo()
      this.events.on('booster:content:update', this.embedGeo.bind(this))
      return this.events.trigger('booster:geo:visitor', this.customer, true)
    }

    get(){
        return this.customer
    }
}

class BstrBlockLink {
    constructor(){
        this.initBlockLinks()
    }

    initBlockLinks() {
        let blockLinks = document.querySelectorAll('.background_image--link');
        blockLinks.forEach((e)=>{
           e.addEventListener('click', function() {
                let backgroundImageUrl = e.dataset.backgroundImageUrl;
                location.href = backgroundImageUrl;
           })
        })
    }
}

class BstrProductCompare {
    constructor() {
        this.sessionKey = 'BoosterProductCompare'
        this.productCompareItems = {}
        this.maxItem = 3
        this.initProductCompare()
    }

    initProductCompare() {
        let sessionItems = JSON.parse(sessionStorage.getItem(this.sessionKey));
        if(sessionItems) {
            this.productCompareItems = sessionItems.products
            this.populateCompareProduct()
        }

        let productCompareCheckbox = document.querySelectorAll("[data-compare-checkbox]")
        productCompareCheckbox.forEach(e => {
            if(this.productCompareItems[e.value] !== undefined) {
                e.checked = true;
            }
            e.addEventListener('change', event => this.productCompare(event))
        })

        let drawerClearAll = document.querySelector("[data-product-compare-clear-all]");
        drawerClearAll.addEventListener('click', e => this.clearAll());

        let viewCompare = document.querySelector("[data-product-view-compare]")
        viewCompare.addEventListener('click', e => {
            e.preventDefault();
            this.viewCompare()
        });

        this.productCompareCheckboxCheckOpen()
        this.toggleCompareDrawer();
        this.toggleCompareButton();
        this.toggleCheckboxes()
        this.productCompareDrawerTrigger();
    }

    productCompare(event) {
        let value = event.target.value
        let isChecked = event.target.checked

        if(isChecked) {
            let productData = JSON.parse(document.querySelector(`[data-product-compare-id='${value}']`).innerText)
            this.productCompareItems[value] = productData
        } else {
            this.removeCompareProduct(value)
        }

        this.productCompareCheckboxCheckOpen()
        this.setSessionStorage()
        this.populateCompareProduct()
        this.toggleCompareDrawer();
        this.toggleCompareButton();
        this.toggleCheckboxes();
    }

    productCompareDrawerTrigger() {
        let trigger = document.querySelector('[data-product-compare-trigger]')
        if(trigger) {
            trigger.addEventListener('click', e => {
                trigger.parentElement.parentElement.parentElement.classList.toggle('minimize')
                if (trigger.parentElement.parentElement.parentElement.classList.contains('minimize')) {
                    this.backToTopButtonMinimize()
                } else {
                    this.backToTopButtonOpen()
                }
            })
        }
    }

    toggleCompareDrawer() {
        if(Object.keys(this.productCompareItems).length >= 1) {
            this.openCompareDrawer()
        } else {
            this.closeCompareDrawer()
        }
    }

    toggleCompareButton() {
        if(Object.keys(this.productCompareItems).length > 1) {
            this.enableCompareButton()
        } else {
            this.disabledCompareButton()
        }
    }

    enableCompareButton() { 
        let compareButton = document.querySelector('[data-product-view-compare]')
        compareButton.disabled = false
    }

    disabledCompareButton() {
        let compareButton = document.querySelector('[data-product-view-compare]')
        compareButton.disabled = true
    }

    openCompareDrawer() {
        let compareDrawer = document.querySelector('[data-product-compare-drawer]')
        compareDrawer.classList.add('open')
        this.backToTopButtonOpen()
    }

    closeCompareDrawer() {
        let compareDrawer = document.querySelector('[data-product-compare-drawer]')
        compareDrawer.classList.remove('open')
        this.backToTopButtonClose()
    }

    toggleCheckboxes() {
        if(Object.keys(this.productCompareItems).length >= this.maxItem) {
            this.disabledCheckboxes()
        } else {
            this.enableCheckboxes()
        }
    }

    disabledCheckboxes() {
        let checkboxes = document.querySelectorAll('[data-compare-checkbox]')
        if (checkboxes) {
            checkboxes.forEach(e => {
                if(!e.checked) {
                    e.disabled = true
                }
            })
        }
    }

    enableCheckboxes() {
        let checkboxes = document.querySelectorAll('[data-compare-checkbox]')
        if (checkboxes) {
            checkboxes.forEach(e => {
                e.disabled = false
            })
        }
    }

    productCompareCheckboxCheckOpen() {
        if(window.innerWidth < 767 ) {
            let checkboxes = document.querySelectorAll('[data-compare-checkbox]')
            checkboxes.forEach(e => {
                e.parentElement.parentElement.classList.remove('hide')
            })
        } else {
            let length = Object.keys(this.productCompareItems).length
            let checkboxes = document.querySelectorAll('[data-compare-checkbox]')
            if(length > 0) {
                checkboxes.forEach(e => {
                    e.parentElement.parentElement.classList.remove('hide')
                })
            } else {
                checkboxes.forEach(e => {
                    e.parentElement.parentElement.classList.add('hide')
                })
            }
        }
    }

    renderCompareProduct(product){
        let productTemplate = document.getElementById('productCompareTemplate').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        $c('[data-product-compare-drawer-image]').src = product.image;
        $c('[data-product-compare-drawer-title]').href = product.url;
        $c('[data-product-compare-drawer-title]').innerText = product.title;
        $c('[data-product-compare-drawer-remove]').dataset.productCompareId = product.id
        $c('[data-product-compare-drawer-remove]').addEventListener('click', e => this.removeCompareProduct(product.id))
        return productTemplate;
    }

    renderCompareDisableProduct(index){
        let productTemplate = document.getElementById('productCompareDisableTemplate').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        let itemPosition = '';

        switch(index) {
            case 2:
                itemPosition = 'second'
                break;
            case 3:
                itemPosition = 'third'
                break;
            default:
                itemPosition = ''
        }

        $c('[data-product-compare-drawer-title]').innerText = `Select ${itemPosition} item to compare`;
        return productTemplate;
    }

    populateCompareProduct() {
        const container = document.querySelector('[product-compare-items]')
        if(this.productCompareItems) {
            let products = this.productCompareItems
            let length = Object.keys(products).length
            let count = 0;

            var frag = document.createDocumentFragment();
            Object.keys(products).forEach(key => {
                count++;
                const value = products[key];
                frag.appendChild(this.renderCompareProduct(value));
            });
            for (let i = count; i < this.maxItem; i++) {
                frag.appendChild(this.renderCompareDisableProduct(i + 1));
            }
            container.innerHTML = '';
            container.appendChild(frag);
        }
    }

    removeCompareProduct(id) {
        delete this.productCompareItems[id]
        this.productCompareCheckbox();
        this.setSessionStorage();
        this.populateCompareProduct();
        this.productCompareCheckboxCheckOpen()
        this.toggleCompareDrawer()
        this.toggleCompareButton()
        this.toggleCheckboxes()
    }

    setSessionStorage() {
        let data = {
            "enabled": true,
            "products" : this.productCompareItems
        }
        sessionStorage.setItem("BoosterProductCompare",JSON.stringify(data) );
    }

    productCompareCheckbox() {
        let productCompareCheckbox = document.querySelectorAll("[data-compare-checkbox]")
        productCompareCheckbox.forEach(e => {
            if(this.productCompareItems[e.value] !== undefined) {
                e.checked = true;
            } else {
                e.checked = false;
            }
        })
    }

    clearAll() {
        this.productCompareItems = {};
        sessionStorage.removeItem("BoosterProductCompare");
        this.productCompareCheckbox();
        this.populateCompareProduct();
        this.productCompareCheckboxCheckOpen()
        this.toggleCompareDrawer()
        this.toggleCompareButton()
        this.closeModalOverlay()
        this.toggleCheckboxes()
    }

    renderCompareProductCard(product) {
        let productTemplate = document.getElementById('productCompareCard').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        $c('[data-compare-product-image]').src = product.image;
        $c('[data-compare-compare-at-price]').innerText = product.compare_at_price;
        $c('[data-compare-product-price]').innerText = product.price;
        $c('[data-compare-product-title]').innerText = product.title;
        return productTemplate;
    }

    renderCompareProductDescription(product) {
        let productTemplate = document.getElementById('productCompareDescription').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        $c('[data-product-compare-description]').innerHTML = product.description;
        return productTemplate;
    }

    renderCompareProductAvailability(product) {
        let productTemplate = document.getElementById('productCompareAvailability').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        $c('[data-product-compare-availability]').innerHTML = product.availability;
        return productTemplate;
    }

    renderCompareProductVendor(product) {
        let productTemplate = document.getElementById('productCompareVendor').cloneNode(true).content.children[0]
        const $c = (q)=>productTemplate.querySelector(q)
        $c('[data-product-compare-vendor]').innerHTML = product.vendor;
        return productTemplate;
    }

    renderCompareProductModal() {
        const productCardContainer = document.querySelector('[data-compare-product-card--holder]')
        const productDescriptionContainer = document.querySelector('[data-compare-product-description--holder]')
        const productAvailabilityContainer = document.querySelector('[data-compare-product-availability--holder]')
        const productVendorContainer = document.querySelector('[data-compare-product-vendor--holder]')

        let products = this.productCompareItems
        var fragProduct = document.createDocumentFragment();
        var fragDescription = document.createDocumentFragment();
        var fragAvailability = document.createDocumentFragment();
        var fragVendor = document.createDocumentFragment();

        Object.keys(products).forEach(key => {
            fragProduct.appendChild(this.renderCompareProductCard(products[key]));
            fragDescription.appendChild(this.renderCompareProductDescription(products[key]));
            fragAvailability.appendChild(this.renderCompareProductAvailability(products[key]));
            fragVendor.appendChild(this.renderCompareProductVendor(products[key]));
        });

        productCardContainer.innerHTML = '';
        productCardContainer.appendChild(fragProduct);

        productDescriptionContainer.innerHTML = '';
        productDescriptionContainer.appendChild(fragDescription);

        productAvailabilityContainer.innerHTML = '';
        productAvailabilityContainer.appendChild(fragAvailability);

        
        productVendorContainer.innerHTML = '';
        productVendorContainer.appendChild(fragVendor);

        this.comparePageListener();
        this.openProductCompareModal();
    }

    viewCompare() {
        if(this.productCompareItems) {
            this.renderCompareProductModal()
        } else {

        }
    }

    comparePageListener() {
        let compareFilter = document.querySelectorAll('[data-compare-product-filter-input]')
        compareFilter.forEach(e => {
            e.addEventListener('input', i => {
                let hasChecked = false;
                compareFilter.forEach( z => {
                    let input = z.dataset.compareProductFilterInput;
                    let isFilterChecked = z.checked;
                    if(!isFilterChecked) {
                        let content = document.querySelector(`[data-compare-product-content="${input}"]`)
                        content.classList.add('hide')
                    } else {
                        hasChecked = true;
                    }
                })

                let compareProductFilterInput = i.target.dataset.compareProductFilterInput;
                let isChecked = i.target.checked;
                if(isChecked) {
                    let content = document.querySelector(`[data-compare-product-content="${compareProductFilterInput}"]`)
                    content.classList.remove('hide')
                } else {
                    let content = document.querySelector(`[data-compare-product-content="${compareProductFilterInput}"]`)
                    content.classList.add('hide')
                }


                if(hasChecked == false) {
                    compareFilter.forEach( z => {
                        let input = z.dataset.compareProductFilterInput;
                        let content = document.querySelector(`[data-compare-product-content="${input}"]`)
                        content.classList.remove('hide')
                    })
                }
            })
        })

        let closeProductCompareModal = document.querySelector('[data-compare-product-modal-close]')
        closeProductCompareModal.addEventListener('click', e => { this.closeProductCompareModal() } )
    }

    openProductCompareModal() {
        let compareProductModal = document.querySelector('[data-compare-product-modal]')
        compareProductModal.classList.add('open')
        this.closeCompareDrawer()
        this.openModalOverlay()
    }

    closeProductCompareModal() {
        let compareProductModal = document.querySelector(['[data-compare-product-modal]'])
        compareProductModal.classList.remove('open')
        this.openCompareDrawer()
        this.closeModalOverlay()
    }

    backToTopButtonOpen() {
        let drawerHeight = document.querySelector('[data-product-compare-drawer]').offsetHeight
        let scrollTopButton =  document.querySelector('#scrollTopBtn')
        if(scrollTopButton) {
            scrollTopButton.style.bottom = `${drawerHeight + 20}px`;
        }
    }

    backToTopButtonMinimize() {
        let drawerHeight = document.querySelector('[data-product-compare-drawer]').offsetHeight
        let itemContainerHeight = document.querySelector('.product-compare-drawer__container').offsetHeight + 36
        let scrollTopButton =  document.querySelector('#scrollTopBtn')
        scrollTopButton.style.bottom = `${drawerHeight - itemContainerHeight}px`;
    }

    backToTopButtonClose() {
        let drawerHeight = document.querySelector('[data-product-compare-drawer]').offsetHeight
        let scrollTopButton =  document.querySelector('#scrollTopBtn')
        if(scrollTopButton) {
            scrollTopButton.style.bottom = `18px`;
        }
    }

    openModalOverlay() {
        let overlay = document.querySelector('[data-compare-product-modal-overlay]')
        let body = document.querySelector('body')
        overlay.classList.add('active')
        body.classList.add('product-compare-modal-open')
    }

    closeModalOverlay() {
        let overlay = document.querySelector('[data-compare-product-modal-overlay]')
        let body = document.querySelector('body')
        overlay.classList.remove('active')
        body.classList.remove('product-compare-modal-open')
    }
}
       
class BstrLoginPopup {
    constructor(){
        this.initPopup()
    }

    initPopup() {
        let popupButton = document.querySelectorAll('[data-login-popup]');
        let userButton = document.querySelector('#user__button');
        let loginForm = document.querySelector('[data-login-popup-form]')
        let registerForm = document.querySelector('[data-register-popup-form]')
        let body = document.querySelector('body');
        
        if(popupButton) {
            popupButton.forEach((e)=>{ 
                e.addEventListener('click', function(e) {
                    let loginPopup = document.querySelector('[data-login-popup-container]')
                    loginPopup.style.display = 'block';
                    userButton.checked = false;
                    loginForm.style.display = 'block';
                    registerForm.style.display = 'none';
                })
            })
        }

        let registerPopup = document.querySelectorAll('[data-login-popup-register]');
        if(registerPopup) {
            registerPopup.forEach((e)=>{
                e.addEventListener('click', function(e) {
                    let loginPopup = document.querySelector('[data-login-popup-container]')
                    loginPopup.style.display = 'block';
                    userButton.checked = false;
                    loginForm.style.display = 'none';
                    registerForm.style.display = 'block';
                })
            })
            
        }

        let signinPopup = document.querySelectorAll('[data-login-popup-signin]');
        if(signinPopup) {
            signinPopup.forEach((e)=>{  
                e.addEventListener('click', function(e) {
                    loginForm.style.display = 'block';
                    registerForm.style.display = 'none'
                })
            })
        }

        let popupLogingOverlay = document.querySelector('.login-popup-overlay');
        if(popupLogingOverlay) {
            popupLogingOverlay.addEventListener('click', function(e) {
                let loginPopup = document.querySelector('[data-login-popup-container]')
                loginPopup.style.display = 'none';
            })
        }
        
    }
}
class BstrCartUpsell {
    toggleUpsellVariantUI(product_id, variant_id, price ) {
        let variantPrice = document.querySelectorAll(`.jsPrice[data-product-id="${product_id}"]`)
        if(variantPrice) {
            variantPrice.forEach(e => {
                e.innerHTML = price
            }) 
        }
   }

   quantityHandler(event, incr, product_id) {
    const upsellQuantityInput = document.querySelectorAll(`[data-cart-upsell-quantity-id="${product_id}"]`);
    if(incr) {
        upsellQuantityInput.forEach(e => {
            e.value = parseInt(e.value) + 1
        });
        upsellQuantityInput.value = parseInt(upsellQuantityInput.value) + 1
    } else {
        upsellQuantityInput.forEach(e => {
            if(parseInt(e.value) > 1) {
                e.value = parseInt(e.value) - 1 
            }
        });
    }
   }
}
        
class BstrScrollText {
    constructor() {
        document.querySelectorAll("[data-scroll-text-section]").forEach(section => this.initSection(section));
    }

    initSection(section) {
        const marquee = section.querySelector("[data-marquee]");
        const marqueeItems = section.querySelectorAll("[data-marquee-items]");
        if (marquee) {
            marqueeItems.forEach(el => this.cloneItems(el));
            this.observeAnimations(marquee);
        }
    }

    cloneItems(el) {
        const items = el.querySelectorAll("[data-marquee-item]");
        const width = el.offsetWidth;
        const totalItemWidth = Array.from(items).reduce((total, item) => total + item.offsetWidth, 0);
        const numItems = Math.ceil(width / totalItemWidth);
        for (let i = 0; i < numItems; i++) {
            items.forEach(item => el.appendChild(item.cloneNode(true)));
        }
    }

    observeAnimations(marquee) {
        new IntersectionObserver(debounce(entries => {
            marquee.classList.toggle("marquee--is-animated", entries[0].isIntersecting);
        }, 100, false)).observe(marquee);
    }
}

class BstrProductImageHandler extends BstrSlider  {
    constructor(props) {
        super(props)
        this.initProductImage() 
    }

    initProductImage() {
        setTimeout(() => {
            let slider = document.querySelectorAll('.slider--product-holder');
            if(slider) {
                slider.forEach(e => {
                    e.style.visibility = 'visible';
                    if(!_settings.variantShowImage) {
                        let index = 0;
                        super._moveTo({e, index});
                    }
                })
            }
        }, 300);
    }
}

class BstrTheme{
    constructor(){
        this.events = new BstrEvents()
        this.basync = new BstrAsync({events: this.events})
        this.initFeaturedProducts()
        document.dispatchEvent(new CustomEvent('booster:initialized', {detail: {BoosterTheme: this}}))
        this.notify = new BstrNotify({events: this.events})
        this.cart = new BstrCart({events: this.events, basync: this.basync})
        this.lazy = new BstrLazy({events: this.events})
        this.defaultSlider = new BstrSlider({events: this.events})
        this.PPSlider = new ProductSlider({events: this.events, selector: '[data-bstr-ppslider]'})
        this.sectionSlider = new BstrSectionSlider({events: this.events, selector: '[data-bstr-section-slider]'})
        this.cfx = new BstrCurrency({events: this.events})
        this.swatches = new BstrSwatches({events: this.events, slider: this.PPSlider, cfx: this.cfx})
        this.counters = {
            cart: new BstrCntr('[data-bstr-cntr-id^="c-"]'),
            watching: new BstrCntr('[data-bstr-cntr-id^="w-"]')
        }
        this.countdown = new BstrCountdown({events: this.events})
        this.filters = new BstrFilters({events: this.events, basync: this.basync})
        this.insta = BstrDummyClass // disabled
        this.visitor = new BstrVisitor({events: this.events, basync: this.basync})
        this.localize = new BstrLocalize({events: this.events, cfx: this.cfx})
        this.freeShippingBar = new BstrFreeShipping({events: this.events, cfx: this.cfx})
        this.inlineUpsell = new BstrIU({events: this.events, cfx: this.cfx, swatches: this.swatches})
        this.ELEMENTS = new BstrElements({events: this.events, basync: this.basync, cart: this.cart, cfx: this.cfx})
        if(_settings.OPDynTitle.trim() != '' || _settings.BPDynTitle.trim() != '') this.dynt = new BstrDynTitle()
        if(_settings.copycat) this.copycat = new BstrCopycat()
        if(_settings.gdpr) this.gdpr = new BstrGDPR()
        if (_settings.cardNameLimit !== 'none') this.cardNameLimit = new ProductTitleTruncate({ events: this.events });
        this.prodTitle = new ProductTitleTruncate({ events: this.events, cardClass: '.product__title--truncated' });
        if(_settings.recentlyBought && typeof recentlyBoughtConfig !== 'undefined') this.recentlyBought = new BstrRecentlyBought()
        this.blockLink = new BstrBlockLink();
        if(_settings.productCompare) this.productCompare = new BstrProductCompare();
        this.loginPopup = new BstrLoginPopup();
        this.cartUpsell = new BstrCartUpsell();
        this.defaultCarousel = new BstrCarousel()
        this.scrollText = new BstrScrollText();
        this.productImageHandler = new BstrProductImageHandler({events: this.events}); 
        this.events.trigger('booster:loaded', {BoosterTheme: this})
    }

    async initFeaturedProducts(){
        try{
            let products = document.querySelectorAll('[data-featured-product]');
            for(let i = 0, maxi = products.length; i < maxi; ++i){
                this.renderFeaturedProduct(products[i]);  
            }
        }catch{}
      }
}

const bstore = new BstrStore();
const BoosterTheme = new BstrTheme()

console.info('888888b.                              888                88888888888 888                                      \n888  "88b                             888                    888     888                                      \n888  .88P                             888                    888     888                                      \n8888888K.   .d88b.   .d88b.  .d8888b  888888 .d88b.  888d888 888     88888b.   .d88b.  88888b.d88b.   .d88b.  \n888  "Y88b d88""88b d88""88b 88K      888   d8P  Y8b 888P"   888     888 "88b d8P  Y8b 888 "888 "88b d8P  Y8b \n888    888 888  888 888  888 "Y8888b. 888   88888888 888     888     888  888 88888888 888  888  888 88888888 \n888   d88P Y88..88P Y88..88P      X88 Y88b. Y8b.     888     888     888  888 Y8b.     888  888  888 Y8b.     \n8888888P"   "Y88P"   "Y88P"   88888P\'  "Y888 "Y8888  888     888     888  888  "Y8888  888  888  888  "Y8888  ');