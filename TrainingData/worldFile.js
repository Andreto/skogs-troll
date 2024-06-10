// worldfiles.js
// Detaild information about the worldfile format can be found at https://en.wikipedia.org/wiki/World_file

exports.worldFile = class {
    constructor(w) {
        // Define World Variables
        this.A = w.A;
        this.B = w.B; 
        this.C = w.C;
        this.D = w.D;
        this.E = w.E;
        this.F = w.F;

        // Define Calculation Variables
        const Xv = Math.atan(w.D/w.A);
        const Yv = Math.atan(w.B/w.E);
        this.Xx = (Math.cos(Xv) ** 2) / w.A;
        this.Xy = (Math.cos(Xv) * Math.sin(Xv)) / w.A;
        this.Yy = (Math.cos(Yv) ** 2) / w.E;
        this.Yx = (Math.cos(Yv) * Math.sin(Yv)) / w.E;
    }

    coordToPx(x, y) { // Convert World Coordinates to Pixel Coordinates
        const Dx = x - this.C;
        const Dy = y - this.F;
    
        const Px = (Dx * this.Xx) + (Dy * this.Yx);
        const Py = (Dx * this.Xy) + (Dy * this.Yy);
        return({x: Px, y: Py});
    }
}

exports.readFile = function (filename) {
    const fs = require('fs')
    data = fs.readFileSync(filename, {encoding:'utf8', flag:'r'}).toString().replace(/\r\n/g,'\n').split('\n');
    return({A: parseFloat(data[0]), D: parseFloat(data[1]), B: parseFloat(data[2]), E: parseFloat(data[3]), C: parseFloat(data[4]), F: parseFloat(data[5])})
}
