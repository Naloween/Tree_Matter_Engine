
import * as tme from "/modules/tree_matter_engine.js";

const void_material = new tme.Material([0,0,0], // Diffusion, i.e color
                                        [1,1,1], // Transparency percentage
                                        [0, 0, 0], // Reflection percentage
                                        [1, 1, 1]); // Refraction indice
const cube_material = new tme.Material([1., 0.1, 0.1],[0, 0, 0],[0, 0, 0],[1, 1, 1]);
let air_material = new tme.Material([1., 1., 1.],[0.99989, 0.99988, 0.99987],[0, 0, 0],[1, 1, 1]);

class Player{
    constructor(position, teta, phi){

        this.position = position;
        this.teta = teta;
        this.phi = phi;

        this.speed = 2;

        this.u = new Array(3);
        this.ux = new Array(3);
        this.uy = new Array(3);

        // events

        this.sensibilite = 0.0003;

        this.rendering = false;
        this.mouse_movement_x = 0;
        this.mouse_movement_y = 0;

        this.change_mode = false;
        this.move_left = false;
        this.move_right = false;
        this.move_front = false;
        this.move_back = false;
        this.move_up = false;
        this.move_down = false;
    }

    update(){        
        this.u[0] = Math.sin(this.phi) * Math.cos(this.teta);
        this.u[1] = Math.sin(this.phi) * Math.sin(this.teta);
        this.u[2] = Math.cos(this.phi);
        
        this.uy = [-Math.cos(this.phi) * Math.cos(this.teta),
            -Math.cos(this.phi) * Math.sin(this.teta),
            Math.sin(this.phi)];
        
        // ux produit vectoriel de u et uy
        
        this.ux = [this.u[1] * this.uy[2] - this.u[2] * this.uy[1],
            this.u[2] * this.uy[0] - this.u[0] * this.uy[2],
            this.u[0] * this.uy[1] - this.u[1] * this.uy[0]];
    }

    nextStep(dt){
        if (!this.rendering){
            return;
        }

        // Mouse

        this.teta += this.sensibilite * this.mouse_movement_x;
        this.phi += this.sensibilite * this.mouse_movement_y;

        this.mouse_movement_x = 0;
        this.mouse_movement_y = 0;

        // Gravity
        //this.position[2] -= dt * 1

        // Movements

        if (this.move_left){
            this.position = add(this.position, mul(this.speed * dt, this.ux));
        }
        if (this.move_right){
            this.position = substract(this.position, mul(this.speed * dt, this.ux));
        } 
        if (this.move_front){
            this.position = add(this.position, mul(this.speed * dt, this.u));
        }
        if (this.move_back){
            this.position = substract(this.position, mul(this.speed * dt, this.u));
        }
        if (this.move_up){
            this.position[2] += this.speed * dt;
        }
        if (this.move_down){
            this.position[2] -= this.speed * dt;
        }

        // Collision
        //TODO

        this.update();
    }
}

class GameEngine{
    constructor(view, material_map, normal_map, player){

        this.material_map = material_map;
        this.normal_map = normal_map;
        this.player = player;
        this.view = view;

        this.render_distance = 400;
        this.min_depth = 14;
        this.max_depth = 17;

        this.dt_fps = 1;
        this.fps = 0;

        //camera
        let width = 1000;
        let height = 600;

        let max_steps = 50;
        let taille_pixel = 4;
        let fov = taille_pixel;
        this.camera = new tme.Camera(width, height, document.getElementById("view"), fov, max_steps, taille_pixel);
        this.camera.position = [this.player.position[0], this.player.position[1], this.player.position[2]];

        // world
        let world_node = this.generate_world(this.camera.position, this.render_distance, this.min_depth, this.max_depth);

        // lights
        let my_light = new tme.Light(10000, [1., 1., 1.], [10,-10,100]);
        let lights = [my_light];

        this.engine = new tme.TreeMatterEngine(this.camera, world_node, lights);
        console.log(this.engine.nodes_lights_array.length)

        // Events

        //lock view
        this.view.addEventListener("click",(event)=> {
            if (event.button == 0){
                this.view.requestPointerLock();
            }
        });

        // Player control
        window.addEventListener("keydown", function(event){
            if (event.code == "AltLeft"){
                this.player.change_mode = true;
            } else if(event.code == "KeyW"){
                this.player.move_front = true;
            } else if(event.code == "KeyS"){
                this.player.move_back = true;
            } else if(event.code == "KeyA"){
                this.player.move_left = true;
            } else if(event.code == "KeyD"){
                this.player.move_right = true;
            }  else if(event.code == "Space"){
                this.player.move_up = true;
            } else if(event.code == "ShiftLeft"){
                this.player.move_down = true;
            } else if(event.code == "ArrowUp"){
                this.player.speed *= 2;
            } else if(event.code == "ArrowDown"){
                this.player.speed /= 2;
            }
        }.bind(this));
        
        window.addEventListener("keyup", function(event){
            if (event.code == "AltLeft"){
                this.player.change_mode = false;
            } else if(event.code == "KeyW"){
                this.player.move_front = false;
            } else if(event.code == "KeyS"){
                this.player.move_back = false;
            } else if(event.code == "KeyA"){
                this.player.move_left = false;
            } else if(event.code == "KeyD"){
                this.player.move_right = false;
            }  else if(event.code == "Space"){
                this.player.move_up = false;
            } else if(event.code == "ShiftLeft"){
                this.player.move_down = false;
            }
        }.bind(this));

        document.addEventListener('pointerlockchange', (()=>{
            if (document.pointerLockElement === this.view) {
                if (!this.player.rendering){
                    this.player.rendering = true;
                }
            } else {
                this.player.rendering = false;
            }
        }).bind(this), false);

        document.addEventListener("mousemove", ((event)=>{
            if( this.player.rendering){
                this.player.mouse_movement_x += event.movementX;
                this.player.mouse_movement_y += event.movementY;
            }
        }).bind(this), false);

        // Player Actions
        // window.addEventListener("mousedown", function(event){
        //     if (event.button == 2){
        //         let v = [Math.sin(this.player.phi) * Math.cos(this.player.teta),
        //                 Math.sin(this.player.phi) * Math.sin(this.player.teta),
        //                 Math.cos(this.player.phi)];
        //         let intersection = add(this.castRay(this.player.position, v), mul(-0.1, v));
        //         this.placeCube(intersection);
        //     }
        // }.bind(this));
    }

    find_bound(start_position, end_position, n_iter){
        let u = [end_position[0] - start_position[0], end_position[1] - start_position[1], end_position[2] - start_position[2]];
        let min_m = 0.;
        let max_m = 1.;
        let m = (max_m + min_m)/2;
        //let start_material = this.material_map(start_position[0], start_position[1], start_position[2]);
        let end_material = this.material_map(end_position[0], end_position[1], end_position[2]);
        
        for (let i = 0; i<n_iter; i++){
            m = (max_m + min_m)/2;
            let check_material = this.material_map(start_position[0] + m*u[0], start_position[1] + m*u[1], start_position[2] + m*u[2]);
            if (check_material == end_material){
                max_m = m;
            } else{
                min_m = m;
            }
        }

        // for (let i = 0; i<n_iter; i++){
        //     m = min_m + i * (max_m - min_m)/n_iter;
        //     let check_material = this.material_map(start_position[0] + m*u[0], start_position[1] + m*u[1], start_position[2] + m*u[2]);
        //     if (check_material == end_material){
        //         break;
        //     }
        // }

        return [start_position[0] + m*u[0], start_position[1] + m*u[1], start_position[2] + m*u[2]];
    }

    generate_node(node, position, render_distance, min_depth, max_depth){

        let render_distance_rate = render_distance;
        
        let nodes = [node];
        let node_generating = node;      
        
        while (nodes.length > 0){

            node_generating = nodes.pop();

            let dx = Math.abs((node_generating.bounds[1]-node_generating.bounds[0])/2);
            let dy = Math.abs((node_generating.bounds[3]-node_generating.bounds[2])/2);
            let dz = Math.abs((node_generating.bounds[5]-node_generating.bounds[4])/2);
            let l = Math.sqrt(dx*dx + dy*dy + dz*dz);
            let center = node_generating.get_center();            
            let normale = this.normal_map(center[0], center[1], center[2]);
            let start_point = [center[0] - l * normale[0], center[1] - l * normale[1], center[2] - l * normale[2]];
            let end_point = [center[0] + l * normale[0], center[1] + l * normale[1], center[2] + l * normale[2]];
            let start_material = this.material_map(start_point[0], start_point[1], start_point[2]);
            let end_material = this.material_map(end_point[0], end_point[1], end_point[2]);
            let distance_to_node = Math.max(node_generating.distance_from(position), 0);
            let dividing = node_generating.depth < min_depth * Math.exp(-distance_to_node / render_distance_rate) || (node_generating.depth < max_depth * Math.exp(-distance_to_node / render_distance_rate) && start_material != end_material);

            // divide node
            if (dividing){
                let materials = [];
    
                for (let k=0; k<2; k++){
                    for (let j=0; j<2; j++){
                        for (let i=0; i<2; i++){
                            let point = [center[0] - dx/2 + i*dx, center[1] - dy/2 + j*dy, center[2] - dz/2 + k*dz];
                            materials.push(this.material_map(point[0], point[1], point[2]));
                        }
                    }
                }
    
                node_generating.divide(materials);
                for (let child of node_generating.childs){
                    nodes.push(child);
                }
            }
            
            if (start_material != end_material){
                // Create plan of the node
                let nb_iterations = 20;// - node_generating.depth;
                node_generating.plan_point = this.find_bound(start_point, end_point, nb_iterations);
                node_generating.plan_vec = normale;
                node_generating.material = end_material;
                node_generating.plan_material = start_material;
            }

            // fusion nodes if necessary
            if (!dividing && node_generating.child_index == 0){
                let node_fusion = node_generating.parent;

                //fusionne si la division n'était pas justifiée
                let fusionne = true;
                for (let child of node_fusion.childs){
                    if (child == null || (child.childs[0] != null || child.material != node_fusion.childs[0].material)){ //on justifie la division et annule la fusion
                        fusionne = false;
                        break;
                    }
                }
    
                while (fusionne){
                    node_fusion.fusion();

                    //on ne fusionne pas le parent tant qu'on a pas fusionné tous ses autres enfants
                    if (node_fusion.child_index > 0 ){
                        break
                    }
                    node_fusion = node_fusion.parent;
    
                    if (node_fusion == null){
                        break;
                    }
        
                    //fusionne si la division n'était pas justifiée
                    fusionne = true;
                    for (let child of node_fusion.childs){
                        if (child == null || child.childs[0] != null || child.material != node_fusion.childs[0].material){ //on justifie la division et annule la fusion
                            fusionne = false;
                            break;
                        }
                    }
                }
            }
        }
    }

    generate_world(position, render_distance, min_depth, max_depth){
    
        let node = new tme.Node(null, 0, void_material, void_material);
        this.generate_node(node, position, render_distance, min_depth, max_depth);
        return node;
    }

    nextFrame(timestamp){

        if (this.player.rendering){
            //time
            const dt = (timestamp - this.previousTimeStamp)/1000; // in secondes
            this.previousTimeStamp = timestamp;
            
            // Player & camera
            this.player.nextStep(dt);
        
            //draw frame
            this.engine.set_camera_position(this.player.position.slice());
            this.engine.set_camera_orientation(this.player.teta, this.player.phi);
            this.engine.render();

            //update infos
            
            //fps
            this.dt_fps += dt;
            this.fps += 1;

            if (this.dt_fps > 0.5){
                let fps = document.getElementById("fps");
                fps.innerText = (1/dt).toFixed(2) + "fps";
                this.dt_fps = 0;
                this.fps = 0;
            }

            //position
            let element_position_x = document.getElementById("position_x");
            let element_position_y = document.getElementById("position_y");
            let element_position_z = document.getElementById("position_z");
            element_position_x.innerText = "x: " + this.player.position[0].toFixed(2);
            element_position_y.innerText = "y: " + this.player.position[1].toFixed(2);
            element_position_z.innerText = "z: " + this.player.position[2].toFixed(2);
        
            window.requestAnimationFrame(this.nextFrame.bind(this));
        } else {
            this.previousTimeStamp = timestamp;
            window.requestAnimationFrame(this.nextFrame.bind(this));
        }
    }

    run(){
        console.log("starting Game...");
        window.requestAnimationFrame(this.nextFrame.bind(this));
    }
}

export{GameEngine, Player}


