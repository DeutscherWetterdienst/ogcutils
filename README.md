# ogcutils
A collection of OGC Web Services utilities based on OpenLayers and Node.js

# Add to your node.js project
To use the ``ogcutils`` package, simple add the dependency to your ``package.json`` as follows:

```
npm i @deutscherwetterdienst/ogcutils
```


# Test the ogcutils package
To test the ``ogcutils`` package, import it in your js file and run the ``getAvailableLayers`` method:
```
import {getAvailableLayers} from 'ogcutils'

capabilitiesUrl = "<url that points to the capabilities xml document>" // usually something like https://example.com/wms?request=GetCapabilities

getAvailableLayers(capabilitiesUrl).then((layers) => {
    console.log("Available Layers:", layers)
});
```