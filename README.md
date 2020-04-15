# ogcutils
A collection of OGC Web Services utilities based on OpenLayers and Node.js

# Add to your node.js project
To use the ``ogcutils`` package, simple add the dependency to your ``package.json`` as follows.

## Add a specific version
To add a specific release of the package, check out the [releases](https://github.com/EduardRosert/ogcutils/releases) page for available versions, and then add a version (e.g. ``0.0.13``) by appending it with a hashtag: 
```
  "dependencies": {
    "ogcutils": "github:eduardrosert/ogcutils#0.0.13",
  }
```

## Add the latest release
To add the latest (development) version from the master branch, use:
```
  "dependencies": {
    "ogcutils": "github:eduardrosert/ogcutils#master",
  }
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