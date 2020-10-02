Create a Tabs Outliner view from JSON data for import.

### Usage

First you need to get tab data in JSON format from a browser, or any other way you can.  
It expects a JSON Array with each entry having a title and url property. (Extra properties don't matter and won't be used)  
`[{"title": "one", "url":"http://host.url"}, {"title": "two", "url":"http://host2.url"}]`

Open the included HTML file and choose or drag&drop a file.  
You can also paste straight into the webpage if you have your JSON in clipboard.

Your data is imported and you can simply drag and drop to your main Tabs Outliner as usual and do whatever you want.

### Getting the data for the function
 
#### Android (through USB debug)

 Set up a route to chrome debug internals:
 adb forward tcp:9222 localabstract:chrome_devtools_remote
 Grab the json data from it at localhost:9222 (can just use browser + devtools network tab)
 Save data as global tabs var and run the function. (in devtools: var tabs = "<json paste here>"
