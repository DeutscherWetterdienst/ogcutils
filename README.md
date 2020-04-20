


# ogcutils
A collection of OGC Web Services utilities based on OpenLayers and Node.js

[![Version](https://img.shields.io/github/package-json/v/eduardrosert/ogcutils?label=ogcutils)](https://www.npmjs.com/package/@deutscherwetterdienst/ogcutils)
[![License](https://img.shields.io/npm/l/@deutscherwetterdienst/ogcutils)](https://www.npmjs.com/package/@deutscherwetterdienst/ogcutils)
[![CircleCI](https://circleci.com/gh/EduardRosert/ogcutils.svg?style=shield)](https://circleci.com/gh/EduardRosert/ogcutils)



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
