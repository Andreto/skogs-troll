const sharp = require('sharp');
const fs = require('fs');
const xml2js = require('xml2js');

const wf = require('./worldFile.js')
 
mapName = 'GE2';

var mapImgWrld = new wf.worldFile(wf.readFile('./maps/' + mapName + '.pgw'));
var mapImg = sharp('./maps/' + mapName + '.png');
var list = [];

// Load map data
var mapData = new xml2js.Parser();
fs.readFile('./maps/' + mapName + '.omap', function(err, data) {
    mapData.parseString(data, function (err, result) {
        console.log('Map-file loaded successfully!');
        handleMapData(result.map.barrier[0].symbols[0].symbol, result.map.barrier[0].parts[0].part[0].objects[0].object, result.map.georeferencing[0]) 
    });
});

// ['Punkthöjd', 'Sten', 'Stor sten', 'Sten, mellanstorlek']
// sym.name.replace(/[(),\-:%]/g, '').replace(/[ /]/g, '_')

// trigger = {
//     'key': 'type',
//     'val': ['1']
// };

trigger = {
    'key': 'code',
    'val': ['504.0']
};

var MapData = {
    symbolIdList: [],
    symbolIdVar: {},
    objects: {},
    coords: {},
}

function handleMapData(symbols, objects, proj) {
    console.log(symbols.length, 'symbols and', objects.length ,'objects loaded.')

    fs.writeFileSync('export.json', JSON.stringify(symbols));

    // Find Symbols
    for (let i = 0; i < symbols.length; i++) {
        var sym = symbols[i]['$'];
        if (trigger.val.includes(sym[trigger.key])) {
            MapData.symbolIdVar[sym.id] = sym.code.replace(/\./g, '_');
            MapData.symbolIdList.push(sym.id);
            MapData.objects[sym.id] = [];
        }
    }

    // Find Objects
    for (let i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (MapData.symbolIdList.includes(obj['$'].symbol)) {
            MapData.objects[(obj['$'].symbol).toString()].push(obj);
        }
    }

    // Review Object-Findings and retrieve object coords as Json
    for (let i = 0; i < MapData.symbolIdList.length; i++) {
        //console.log(MapData.objects[MapData.symbolIdList[i]].length, 'objects of type', MapData.symbolIdList[i], '('+MapData.symbolIdVar[MapData.symbolIdList[i]]+')')
        obj = MapData.objects[MapData.symbolIdList[i]];
        MapData.coords[MapData.symbolIdList[i]] = [];
        for (let j = 0; j < obj.length; j++) {
            var coords = obj[j]['coords'][0]['_'].split(';');
            coords.splice(-1, 1)
            for (let c = 0; c < coords.length; c++) {
                coords[c] = coords[c].split(' ').slice(0, 2);
                coords[c] = coords[c].map((x) => (parseFloat(x)));
                MapData.coords[MapData.symbolIdList[i]].push(coords[c]);
            }
            
        }
    }


    // Lookup Georeferencing
    try {
        var geoRef = {
            'scale': parseInt(proj['$'].scale),
            'auxiliary_scale_factor': parseFloat(proj['$'].auxiliary_scale_factor),
            'declination': parseFloat(proj['$'].declination),
            'grivation': parseFloat(proj['$'].grivation),
            'projected_crs': {
                'epsg': proj['projected_crs'][0]['parameter'][0],
                'ref': {
                    'x': parseFloat(proj['projected_crs'][0]['ref_point'][0]['$'].x),
                    'y': parseFloat(proj['projected_crs'][0]['ref_point'][0]['$'].y)
                }
            },
        }
    } catch (error) {
        console.error('Failed to load georeferencing:', error);
        return;
    }


    prepareObjects(MapData, geoRef);
};

function printProg(msg){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(msg);
}



function saveImg() {
    console.log('Saving', list.length, 'images');
    if (list.length <= 0) {
        return;
    }
    const item = list.shift(); // get first item

    mapImg.metadata().then(metadata => {
        console.log('Image Dimensions - Width:', metadata.width, 'Height:', metadata.height);
        console.log('Attempting to extract area:', item.crop);

        // Validate crop area against image dimensions
        if (item.crop.left + item.crop.width > metadata.width ||
            item.crop.top + item.crop.height > metadata.height ||
            item.crop.left < 0 || item.crop.top < 0 ||
            item.crop.width <= 0 || item.crop.height <= 0) {
            console.error('Invalid crop area:', item.crop);
            saveImg(); // Proceed with the next image
            return;
        }

        mapImg.extract(item.crop)
            .toFile(item.fName)
            .then(info => {
                console.log('Saved ' + item.i.toString() + '/' + (list.length + item.i).toString(), item.crop);
                saveImg(); // Recursively save the next image
            })
            .catch(err => {
                console.error('Failed to extract and save image:', err);
                // saveImg(); // Proceed with the next image
            });
    }).catch(err => {
        console.error('Failed to get image metadata:', err);
        saveImg(); // Proceed with the next image
    });
}

function prepareObjects(MapData, geoRef) {
    listI = 1;

    for (let i = 0; i < MapData.symbolIdList.length; i++) {
        id = MapData.symbolIdList[i];
        if (MapData.coords[id].length > 0) {
            console.log('Preparing', MapData.coords[id].length, 'images for', MapData.symbolIdVar[id]);
            if (!fs.existsSync('./imgs/'+MapData.symbolIdVar[id])) {
                fs.mkdirSync('./imgs/'+MapData.symbolIdVar[id]);
            }
        }
        for (let j = 0; j < MapData.coords[id].length; j++) {
            var obj = MapData.coords[id][j];
            x = ((
                    (10**-6)*geoRef.scale *
                    (
                        obj[0]*Math.cos((Math.PI/180)*geoRef.grivation) -
                        obj[1]*Math.sin((Math.PI/180)*geoRef.grivation)
                    )
                ) + geoRef.projected_crs.ref.x);

            y = ((
                    (10**-6)*geoRef.scale *
                    (
                        - obj[0]*Math.sin((Math.PI/180)*geoRef.grivation) -
                        obj[1]*Math.cos((Math.PI/180)*geoRef.grivation)
                    )
            ) + geoRef.projected_crs.ref.y);

            px = mapImgWrld.coordToPx(x, y);
            cropSize = 32;
            var crop = {width: cropSize, height: cropSize, left: parseInt(px.x-(cropSize/2)), top: parseInt(px.y-(cropSize/2))};
            fName = './imgs/' + MapData.symbolIdVar[id] + '/' + mapName + '_' + j.toString() + '.png'
            
            list.push({i: listI, fName: fName, crop: crop});
            listI++;
        }
    }
    saveImg();
}


/*
// original image
let originalImage = 'Igelkartan.png';

// file name for cropped image
let outputImage = 'E3.png';

sharp(originalImage).extract({ width: 32, height: 32, left: 500, top: 300 }).toFile(outputImage)
    .then(function(new_file_info) {
        console.log("Image cropped and saved");
    })
    .catch(function(err) {
        console.log("An error occurred", err);
    });
*/