A script to aid in browsing and downloading twitter images and videos.
Focuses somewhat on art hunting but should be generally useful.

Update: A bunch of features went missing with the rewrite. Some will be added back over time. Docs aren't updated. Basic downloading works.

### Features ###

* Automatic image expansion
* Highlights external links of interest (Pixiv, Tumblr, DeviantArt, ...)
* Download videos
* Should deal with image cards. Still somewhat experimental
* Adds direct links to the original image almost everywhere
    * If the source link on dan/gelbooru is a direct link, it will swap this too for a link to the original.
* Clean up UI clutter
* Option to remove non-image tweets
* Various other minor adjustments
* Configurable to some degree
* Cross-brower (hopefully)
    * Should work in Fire/Waterfox and Chrome anyway.

### Download ###

Main script:

* Install twittertools.user.js with your favourite script manager.
* It should auto-update once installed. (update: not anymore)

Beta/Testing scripts and older versions:

* Find the right file in the Source section

### Usage ###

* Select whether you want all tweets or only image tweets to show.
* Click the "Image mode" link found in various places.
    *  Or use keyboard shortcuts:
        * SHIFT+R to add the buttons again if you lost them. (Workaround for a bit of an annoying bug atm)
        * SHIFT+T to activate.
        * SHIFT+I for image-only mode.
* The configure link will let you set a few options.

### Can I help? ###

* File bugs and feature requests in the tracker.
* Submit patches, why not. Code's a mess though.
