
import * as tme from "/modules/tree_matter_engine.js";
import * as noise from "/modules/noise.js";
import * as ge from "/modules/game_engine.js";


// Materials
let void_material = new tme.Material([0,0,0], // Diffusion, i.e color
                                    [1,1,1], // Transparency percentage
                                    [0, 0, 0], // Reflection percentage
                                    [1, 1, 1]); // Refraction indice
let air_material = new tme.Material([1., 1., 1.],[0.99989, 0.99988, 0.99987],[0, 0, 0],[1, 1, 1]);
let default_material = new tme.Material([0.1, 0.1, 0.1],[0, 0, 0],[0, 0, 0],[1, 1, 1]);
let grass_material = new tme.Material([0.1, 0.6, 0.1],[0, 0, 0],[0, 0, 0],[1, 1, 1]);
let sand_material = new tme.Material([0.7, 0.7, 0.1],[0, 0, 0],[0, 0, 0],[1, 1, 1]);
let snow_material = new tme.Material([0.8, 0.8, 0.8],[0, 0, 0],[0, 0, 0],[1, 1, 1]);
let earth_material = new tme.Material([0.5, 0.45, 0.45], [0, 0, 0], [0, 0, 0], [1, 1, 1]);

// functions

function vec_product(u, v){
    return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1] * v[0]];
}

function scal(u, v){
    return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
}

const altitude_max = 50;
noise.seed(0.42);
function landscape(a, b){

    const f = 100;
    let res = 0;

    for (let k=0; k<6; k++){
        res += altitude_max * noise.perlin2(a * 2**k / f, b * 2**k / f)/ 2**k;
    }

    return res;
}

function material_map(x, y, z){
    if (z < landscape(x, y)){
        if (z < -altitude_max/2){
            return sand_material
        }
        if (z < 0){
            return grass_material
        }
        if (z < altitude_max/2){
            return earth_material
        }
        return snow_material
    }

    if ( z < 3 * altitude_max){
        return air_material;
    }
    return air_material;
}

function normal_map(x, y, z){
    const e = 0.001;
    let h = landscape(x, y);
    let normale = vec_product([e,0,landscape(x + e,y)-h], [0,e,landscape(x,y+e)-h]);
    let norm = Math.sqrt(scal(normale, normale));
    return [normale[0]/norm, normale[1]/norm, normale[2]/norm];
}

let player = new ge.Player([0,0,10],0,Math.PI/2);
  
let game_engine = new ge.GameEngine(document.getElementById("view"), material_map, normal_map, player) 
game_engine.run();