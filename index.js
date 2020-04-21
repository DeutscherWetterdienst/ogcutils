/**
 * OGC Web Service Utilities
 *
 * A collection of utilities to help interact with OGC Web Services
 *
 * REQUIREMENTS
 *
 *  moment^2.24.0
 *  openlayers^5.0
 */


import View from 'ol/View';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import { fromLonLat, transform } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { Vector as VectorSource } from 'ol/source';
import Geometry from 'ol/geom/Geometry';
import moment from 'moment';


const LAYER_BLACKLIST = ["background", "foreground", "grid", "boundaries", "oceans", "bluemarble", "Natural_Earth_Map"]
const PERIODICITY_PATTERN = new RegExp(/^P((\d+)Y)?((\d+)M)?((\d+)D)?(T((\d+)H)?((\d+)M)?((\d+)S)?)?$/, 'i') // precompiled RegExp


/**
 * CAPABILITIES PARSING
 */

/**
 * Coverts an date time string to a date object.
 *
 * @param {String} isoTime An ISO8601 formatted date time string, such as '2020-04-07T06:00:00.000Z' or 'current'
 * @returns {Date} The corresponding date object. For 'current' the current time stamp is returned.
 */
export function toDate  (isoTime) {
    if (isoTime === 'current') {
        return new Date();
    } else {
        return new Date(Date.parse(isoTime))
    }
}

/**
 * Adds a time delta to a Date object.
 *
 * Following keys are supported for delta : years, months, weeks, days, hours, minutes, seconds, milliseconds.
 *
 * @param {Date} time The date to which the time delta should be added
 * @param {Object} delta The delta object formatted as { "key" : number, ... }, e.g. { "years" : 4, "days": 2 }
 * @returns {Date} the new date.
 *
 * @see https://momentjs.com/docs/#/manipulating/add/ for all supported keys/shorhands.
 * @see getPeriodTimedelta on how to get a delta object from an ISO8601 period string.
 */
export function addTimeDelta  (time, delta) {
    var newDate = moment(time)
    Object.keys(delta).forEach(key => {
        var value = delta[key]
        newDate = newDate.add(value, key)
    });
    return newDate.toDate()
}

/**
 * Subtracts a time delta to a Date object.
 *
 * Following keys are supported for delta : years, months, weeks, days, hours, minutes, seconds, milliseconds.
 *
 * @param {Date} time The date from which the time delta should be subtracted
 * @param {Object} delta The delta object formatted as { "key" : number, ... }, e.g. { "years" : 4, "days": 2 }
 * @returns {Date} the new date.
 *
 * @see https://momentjs.com/docs/#/manipulating/add/ for all supported keys/shorhands.
 * @see getPeriodTimedelta on how to get a delta object from an ISO8601 period string.
 */
export function subtractTimeDelta  (time, delta) {
    var newDate = moment(time)
    Object.keys(delta).forEach(key => {
        var value = delta[key]
        newDate = newDate.subtract(value, key)
    });
    return newDate.toDate()
}

/**
 * Converts an ISO8601 period into a delta object.
 *
 * Returns corresponding the timedelta for the time period string.
 * See "OpenGIS Web Map Service (WMS) Implementation Specification"
 * at http://portal.opengeospatial.org/files/?artifact_id=14416
 * Chapter "D.3 Period format"
 * An ISO 8601 Period is used to indicate the time resolution of the available data.
 * The ISO 8601 format for representing a period of time is used to represent the resolution:
 * Designator P (for Period), number of years Y, months M, days D, time designator T,
 * number of hours H, minutes M, seconds S. Unneeded elements may be omitted.
 *
 * EXAMPLES:
 *     P1Y — 1year
 *     P1M10D — 1 month plus 10 days PT2H — 2 hours
 *     PT1.5S — 1.5 seconds (this is not yet supported here)
 *
 * @param {String} period An ISO 8601 Period, e.g. 'P4Y2D' (= 4 years and 2 days)
 * @returns {Object} the corresponding delta object, formatted as { "key" : number, ... }, e.g. { "years" : 4, "days": 2 }
 *
 * @see http://portal.opengeospatial.org/files/?artifact_id=14416 , Chapter "D.3 Period format" on how to format periods
 * @see https://momentjs.com/docs/#/manipulating/add/ for all supported keys/shorhands.
 */
export function getPeriodTimedelta  (period) {
    var xmatch = period.match(PERIODICITY_PATTERN)
    if (xmatch == null) {
        console.log(`Invalid time period format found: '${period}'.`)
        return null
    }

    // HACK: named groups not working for some reason, thats why I use group indices
    var match = {
        "years": xmatch[2],
        "months": xmatch[4],
        "days": xmatch[6],
        "hours": xmatch[9],
        "minutes": xmatch[11],
        "seconds": xmatch[13]
    }

    var delta = {
        "years": 0,
        "months": 0,
        "days": 0,
        "hours": 0,
        "minutes": 0,
        "seconds": 0
    }
    var nonZeroTotalPeriod = false
    Object.keys(delta).forEach(dim => {
        if (match[dim]) {
            delta[dim] = parseInt(match[dim])
            if (delta[dim] > 0) {
                nonZeroTotalPeriod = true
            }
        }

    });

    if (!nonZeroTotalPeriod) {
        console.log(`Invalid time period: '${period}'. Period has zero length.`)
        return null
    }
    return delta
}

/**
 * Converts a WMS time dimension definition into an array of Date objects representing all valid times.
 *
 * Supports single values, intervals and lists of values and intervals, e.g. '2019-11-07T09:00:00Z,2019-11-09T21:00:00Z/2019-11-22T21:00:00Z/P1D'.
 *
 * Example:
 * - input:
 *     "2019-11-07T09:00:00Z,2019-11-09T21:00:00Z/2019-11-22T21:00:00Z/P1D"
 * - output:
 * [   Date("2019-11-07T09:00:00Z"),
 *     Date("2019-11-09T21:00:00Z"),
 *     Date("2019-11-09T21:00:00Z"),
 *     Date("2019-11-10T21:00:00Z"),
 *     Date("2019-11-11T21:00:00Z"),
 *     ... ,
 *     Date("2019-11-21T21:00:00Z"),
 *     Date("2019-11-22T21:00:00Z")
 * ]
 *
 * @param {String} text A WMS dimension 'time' element.
 * @param {Number} limit the maximum number available times, default is 240, set to -1 for no limit
 * @param {Boolean} sorted if False, the times will not be sorted, default True (sorted output)
 * @returns {Date[]} an array of valid Date objects.
 * @see http://portal.opengeospatial.org/files/?artifact_id=14416 Chapter "C.2 Declaring dimensions and their allowed values" on how to format dimension named 'time'
 */

export function enumerateAvailableTimes  (text, limit=240, sorted=true) {
    var definitions = text.split(",");
    var values = []
    definitions.forEach(definition => {
        if (!definition.includes("/")) {
            // simple time stamp given
            values.push(toDate(definition))
        } else {
            // a start/end/period definition given
            var parts = definition.split("/")
            var part1 = toDate(parts[0])
            var part2 = toDate(parts[1])
            var start = (part1.getTime() <= part2.getTime())? part1 : part2
            var end = (part1.getTime() <= part2.getTime())? part2 : part1
            var period = parts[2]
            if (!values.includes(end) ){
                values.push(end)
            }

            var delta = getPeriodTimedelta(period)
            console.log("START: ", start)
            console.log("END: ", end)
            console.log("TIME DELTA: ", delta)

            if (!delta) {
                console.log(`Error parsing the step in time definition: '${definition}'`)
            } else {
                // valid definition, start from the newest and go back
                var timestep = end
                if (limit == -1 ){
                    // no limit
                    while ( timestep.getTime() > start.getTime()) {
                        timestep = subtractTimeDelta(timestep, delta)
                        values.push(timestep)
                    }
                }else{
                    while ( (values.length < limit) && timestep.getTime() > start.getTime()) {
                        timestep = subtractTimeDelta(timestep, delta)
                        values.push(timestep)
                    }
                }

            }
            if (!values.includes(start) ){
                values.push(start)
            }
        }
    });

    if (sorted){
        return values.sort((a,b)=>a.getTime()-b.getTime());
    }else{
        return values
    }
}

/**
 * Receives an openlayers representation of a WMS capabilities xml document and returns the endpoint url for WMS GetMap requests.
 *
 * @param {Object} capability the capability object to analyze (returned by WMSCapabilities.read() method)
 *
 * @returns {Object[]} the WMS GetMap endpoint url or empty string
 *
 * @see https://openlayers.org/en/latest/apidoc/module-ol_format_WMSCapabilities-WMSCapabilities.html read() method
 */
export function getGetMapEndpointUrl(capability) {
    if (capability.Capability) {
        return getGetMapEndpointUrl(capability.Capability);
    } else if (capability.Request
        && capability.Request.GetMap
        && capability.Request.GetMap.DCPType
        && Array.isArray(capability.Request.GetMap.DCPType)
        && capability.Request.GetMap.DCPType.length > 0
        && capability.Request.GetMap.DCPType[0]["HTTP"]
        && capability.Request.GetMap.DCPType[0]["HTTP"]["Get"]
        && capability.Request.GetMap.DCPType[0]["HTTP"]["Get"]["OnlineResource"]) {
        return capability.Request.GetMap.DCPType[0]["HTTP"]["Get"]["OnlineResource"];
    } else {
        return "";
    }
};

/**
 * Receives an openlayers representation of a WMS capabilities xml document and returns a flattened list of all available layers.
 *
 * @param {Object} capability the capability object to analyze (returned by WMSCapabilities.read() method)
 *
 * @returns {Object[]} an array with all available layers
 *
 * @see https://openlayers.org/en/latest/apidoc/module-ol_format_WMSCapabilities-WMSCapabilities.html read() method
 */
export function getAllLayers  (capability) {
    if (capability.Capability){
        return getAllLayers(capability.Capability)
    }else if (capability.Layer) {
        // sublayers exist
        var allLayers = []
        if (Array.isArray(capability.Layer)) {
            capability.Layer.forEach(layer => {
                getAllLayers(layer).forEach(item => {
                    allLayers.push(item)
                })
            });
        } else {
            getAllLayers(capability.Layer).forEach(item => {
                allLayers.push(item)
            })
        }
        return allLayers
    } else {
        return [capability]
    }
}


/**
 * Extracts the bounding box in EPSG:4326 coordinates (lat,lon-order) from a WMS Layer.
 *
 * @param {Object} capaLayer the WMS layer object
 * @returns {Number[]} The bounding box if found, or else [-180, -90, 180, 90] (default)
 */
export function getBoundingBoxLatLon  (capaLayer) {
    if (capaLayer.BoundingBox && Array.isArray(capaLayer.BoundingBox)) {
        for (let i = 0; i < capaLayer.BoundingBox.length; i++) {
            // use a regular for loop instead of foreach, so you can break when EPSG:4326 is found
            var bbox = capaLayer.BoundingBox[i]
            if (bbox.crs && bbox.crs === "EPSG:4326" && bbox.extent) {
                return bbox.extent;
            }
        }
    }
    return [-180, -90, 180, 90] // nothing found, return default
}

/**
 * Fetches a Capabilities XML document from the given url and returns a promise of a list of all available layers.
 *
 * @param {String} capaUrl the url of the XML Capabilities document (usually the result of a WMS GetCapabilities request)
 */
export function getAvailableLayers  (capaUrl) {
    return fetch(capaUrl)
        .then(function (response) {
            return response.text();
        })
        .then(function (text) {
            var parser = new WMSCapabilities();
            var availableLayers = []
            var result = parser.read(text);
            //console.log("GetCapabilities document:", result);
            var capalayers = getAllLayers(result.Capability); // result.Capability.Layer.Layer;
            var getMapUrl = getGetMapEndpointUrl(result.Capability);

            //console.log("All Layers (unprocessed):", capalayers);

            capalayers.forEach(cl => {
                if (!LAYER_BLACKLIST.includes(cl.Name)) {
                    var layer = {
                        "name": cl.Name,
                        "title": cl.Title,
                        "getMapEndpointUrl" : getMapUrl,
                        "time": null,
                        "boundingBox": getBoundingBoxLatLon(cl) //lat,lon is WMS 1.3.0 default
                    }
                    if (cl.Dimension) {
                        cl.Dimension.forEach((dim) => {
                            if (dim.name === 'time') {
                                //console.log("Dimension:", dim)
                                if (dim.default) {
                                    // set default time
                                    layer["time"] = toDate(dim.default)
                                }
                                if (dim.units === "ISO8601") {
                                    layer["times"] = enumerateAvailableTimes(dim.values)
                                }
                            }
                        })
                    }
                    availableLayers.push(layer)
                }
            });
            return availableLayers
        });

}


/**
 * COORDINATE TRANSFORMS
 */

/**
 * Transforms an WMS layer bounding box from EPSG:4326 to EPSG:3857
 *
 * @param {Number[]} bboxLatLon a WMS layer bounding box in lat,lon order and EPSG:4326 coordinates, e.g. [47.13, 5.56, 55.06, 15.77] (Germany)
 * @returns {Number[]} a bounding box with EPSG:3857 coordinates, e.g. [619592.59, 5963772.75, 1755616.41, 7373571.29] (Germany)
 * @see https://openlayers.org/en/latest/apidoc/module-ol_proj.html#.transform for more details
 */
export function transformBoundingBox  (bboxLatLon) {
    return transform([bboxLatLon], "EPSG:4326", "EPSG:3857")
}

/**
 * Transforms a Lon/Lat bounding box to a Lat/Lon polygon
 *
 * @param {Number[][]} bbox the bounding box with lat/lon order, e.g. [ [west, south], [east, north] ]
 * @returns {Number[][]} a polygon [ [west, south], [west, north], [east, north], [east, south], [west, south] ]
 */
export function bboxToPoly  (bbox) {
    /* lon, lat */
    var west = bbox[0][0];
    var south = bbox[0][1];
    var east = bbox[1][0];
    var north = bbox[1][0];
    return [ [west, south], [west, north], [east, north], [east, south], [west, south] ]
}

/**
 * Transforms a WMS layer bounding box (extent) to a polygon.
 *
 * @param {Number[]} extent the WMS layer bounding box with format [ minx, miny, maxx, maxy ]
 * @returns {Number[][]} the corresponding polygon in lat/lon order
 */
export function extentToPoly  (extent) {
    // south, west, north, east
    var bbox = [[extent[1], extent[0]], [extent[3], extent[2]]]
    return bboxToPoly(bbox)
}

/**
 * Converts a WMS layer bounding box with EPSG:4326 into the corresponding geojson polygon
 *
 * @param {Number[]} extent the WMS layer bounding box with format [ minx, miny, maxx, maxy ]
 * @returns {Object} a GeoJSON object (feature with polygon geometry)
 */
export function extentToGeoJson  (extent) {
    var poly = extentToPoly(extent)
    return geoShapeToGeoJson(
        {
            "type": "polygon",
            "coordinates": poly
        }
    )
}


/**
 * Converts an elasticsearch geo_shape object to a GeoJSON object.
 *
 * Currently only geo_shape types 'polygon' and 'envelope' are supported.
 *
 * @param {Object} geo_shape an elasticsearch geo_shape object
 * @returns {Object} the corresponding GeoJSON object
 */
export function geoShapeToGeoJson  (geo_shape) {
    /* Transforms elasticsearch shapes to GeoJSON */
    if (geo_shape.type === "polygon") {
        return { 'type': 'Feature', 'geometry': { 'type': 'Polygon', 'coordinates': geo_shape.coordinates } }
    } else if (geo_shape.type === "envelope") {
        return { 'type': 'Feature', 'geometry': { 'type': 'Polygon', 'coordinates': bboxToPoly(geo_shape.coordinates) } }
    }
}

/**
 * OPENLAYERS HELPERS
 */

/**
 * Centers the openlayers View to the a GeoJSON object
 *
 * @param {Object} geoJsonObject the GeoJSON object
 * @param {View} olView the openlayers View object
 */
export function centerToGeoJsonGeometry  (geoJsonObject, olView) {
    var vectorSource = new VectorSource({
        features: (new GeoJSON()).readFeatures(geoJsonObject)
    });
    var feature = vectorSource.getFeatures()[0];
    centerToGeometry(feature.getGeometry(), olView)
}

/**
 * Centers the openlayers View to a WMS layer bounding box.
 *
 * @param {Number[]} extent the WMS layer bounding box
 * @param {View} olView the openlayers view
 */
export function centerToExtent  (extent, olView) {
    var vectorSource = new VectorSource({
        features: (new GeoJSON()).readFeatures(extentToGeoJson(extent))
    });
    var feature = vectorSource.getFeatures()[0];
    centerToGeometry(feature.getGeometry(), olView)
}

/**
 * Centers the geometry in the View.
 *
 * Transforms the geometry from EPSG:4326 to EPSG:3857 before centering.
 *
 * @param {Geometry} geometry the openlayers geometry with lon/lat order and EPSG:4326 coords
 * @param {View} olView the openlayers View
 *
 * @see https://openlayers.org/en/latest/apidoc/module-ol_geom_Geometry-Geometry.html
 */
export function centerToGeometry  (geometry, olView) {
    /* geometry is in lon, lat */
    var geom = geometry.transform("EPSG:4326", "EPSG:3857");
    olView.fit(geom, { "nearest": true });
}

/**
 * Centers the coordinates of the given point in the openlayers view
 *
 * @param {Number[]} coords the coordinates of the point in lon/lat order and EPSG:4326 coords
 * @param {*} olView the openlayers View
 */
export function centerToLonLat  (coords, olView) {
    olView.setCenter(fromLonLat(coords))
}




// EXAMPLES

/*
// 1. center to elasticsearch location
var locationMeta = [
{
    "title": "Deutschland",
    "description": "SNOW4 Modellgebiet",
    "geo_shape": {
    "type": "polygon",
    "coordinates":[[[5.9,46],[3.5,50.5],[2,55],[15,54.5],[20,51.5],[19.5,49.5],[15.5,46],[5.9,46]]]}
}
]
if (locationMeta && Array.isArray(locationMeta && locationMeta.length > 0)){
geoJs = geoShapeToGeoJson(locationMeta[0]["geo_shape"])
centerToGeoJsonGeometry(geoJs)
}
*/


/*
// 2. center to polygon
const cosmoPolygon = [[[0.25, 43.19],[-3.84, 57.31],[20.21, 57.62],[17.54, 43.42],[0.25, 43.19] ]];
const iconeuPolygon = [[[-23.5, 29.5],[-23.5,70.5],[45,70.5],[45,29.5],[-23.5,29.5]]];

var geojsonObject = {
'type': 'Feature',
'geometry': {
    'type': 'Polygon',
    'coordinates': cosmoPolygon
}
}
centerToGeoJsonGeometry(geojsonObject, view);
*/

/*
// 3. center to Point
const washingtonLonLat = [-77.036667, 38.895]
const offenbachLonLat = [ 8.75, 50.1 ]
centerToLonLat( washingtonLonLat, view )
*/

/*
// 4. center to layer extent
var pollenLayer = { // result of getAvailableLayers
"name": "Pollenfluggebiete",
"title": "Pollenflug-Gefahrenindex",
"time": null,
"boundingBox": [47,5,56,16]
}
centerToExtent( pollenLayer.extent, view )
*/


export function printMsg () {
    console.log("This is the ogcutils package.");
}