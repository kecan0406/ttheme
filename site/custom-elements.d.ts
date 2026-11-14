declare namespace JSX {
  interface HtmlLinkTag {
    onload?: undefined | string
    imagesrcset?: undefined | string
    imagesizes?: undefined | string
  }

  interface HtmlImageTag {
    sizes?: undefined | string
  }

  interface IntrinsicElements {
    'browse-marketplaces': HtmlTag
    'browse-works': HtmlTag
    'cast-search': HtmlTag
    'docs-page': HtmlTag
    'facet-ground': HtmlTag
    'feature-cards': HtmlTag
    'kaomoji-rain': HtmlTag
    'lead-showcase': HtmlTag
    'marketplace-workspace': HtmlTag
    'mode-switch': HtmlTag
    'palette-builder': HtmlTag
    'palette-picker': HtmlTag
    'pill-train': HtmlTag
    'pins-player': HtmlTag
    'route-progress': HtmlTag
    'site-menus': HtmlTag
    'site-search': HtmlTag
    'sparkle-burst': HtmlTag
    'tab-showcase': HtmlTag
    'work-page': HtmlTag
  }
}
