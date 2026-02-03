if(typeof BoosterTheme != "undefined"){
    document.addEventListener('shopify:section:load', ()=>BoosterTheme.events.trigger('booster:content:update'))
} else {
    document.addEventListener('booster:loaded', ()=>{
        document.addEventListener('shopify:section:load', ()=>BoosterTheme.events.trigger('booster:content:update'))
    })
}