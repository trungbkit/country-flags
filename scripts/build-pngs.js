var process = require('process')
var exec = require('child_process').exec
var fs = require('fs')
const PromisePool = require('@supercharge/promise-pool')

var help_message = "You must pass one argument to build-pngs. It should be target dimension in the format `200:` for width 200px, or `:200` for height 200px."
var svg_directory = 'svg/'

// Check arguments
function get_output_directory() {
    // Replace : with x, if two dimensions are specified
    var dim = process.argv[2].split(':').filter(x => x.length > 0)
    var dir = 'png' + (dim.length > 1 ? dim.join('x') : dim) + 'px'

    return dir
}

function get_output_dimensions() {
    return process.argv[2]
}

function check_arguments(callback) {
    if (process.argv.length != 3) {
        console.log(help_message)
        process.exit(1)
    }

    var dimensions = process.argv[2]
    if (/^[0-9]*:[0-9]*$/.test(dimensions) && dimensions.length > 2) {
        var output_folder = get_output_directory()
        console.log("Output folder: " + output_folder)
        
        if (!fs.existsSync(output_folder)){
            fs.mkdirSync(output_folder)
        }

        callback()
    }
    else {
        console.log(help_message)
        process.exit(1)
    }
}

function get_all_svgs(callback) {
    fs.readdir(svg_directory, function(err, items) {
        if (err) {
            console.log("Could not list *.svg files. You probably ran this command from the wrong working directory.")
            console.log(err)
            process.exit(1)
        }

        items = items.filter(path => /^[a-z\-]+\.svg$/.test(path))
        callback(items)
    }, (error) => {})
}

function convert_and_compress_svg(path_to_svg) {
    var path_to_tmp_png = path_to_svg.substring(0, path_to_svg.length - 4) + '.png'
    var svgexport_command = "node_modules/.bin/svgexport " + path_to_svg + " " + path_to_tmp_png + " pad " + get_output_dimensions()
    console.log(svgexport_command)

    return new Promise((resolve, reject) => {
        exec(svgexport_command, (error, stdout, stderr) => {
            if (error) {
                console.log("Failed to convert SVG: " + path_to_svg)
                console.log(error);
                reject(error);
            }
    
            var image_min_command = "node_modules/.bin/imagemin " + path_to_tmp_png + " --out-dir=" + get_output_directory()
            console.log(image_min_command)
            exec(image_min_command, (error, stdout, stderr) => {
                // Always remove temp file
                fs.unlink(path_to_tmp_png, (error) => {})
    
                if (error) {
                    console.log("Failed to convert SVG: " + path_to_svg)
                    console.log(error);
                    reject(error);
                }
    
                resolve()
            })
        })
    })
}

function convert_all_files(svgs) {
    return PromisePool
        .withConcurrency(4)
        .for(svgs)
        .process(svg => convert_and_compress_svg(svg_directory + svg));
}

// Run the program
check_arguments(() =>
    get_all_svgs((svgs) => convert_all_files(svgs).then(() => {
    console.log("All SVGs converted to PNG!")
    process.exit(0)
})));
