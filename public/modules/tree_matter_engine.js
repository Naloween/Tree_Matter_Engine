
const WORLD_SIZE = 10000.0
const MAX_SIZE_ARRAY_GPU = 2**24;

// GPU functions
function intersectionNodeGPU(cast_point, direction, nodes_bounds, node_id){
    const BOUNDS_DATA_SIZE = 6;

    let t_minx = direction[0] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 0] - cast_point[0]) / direction[0];
    let t_maxx = direction[0] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 1] - cast_point[0]) / direction[0];
    let t_miny = direction[1] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 2] - cast_point[1]) / direction[1];
    let t_maxy = direction[1] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 3] - cast_point[1]) / direction[1];
    let t_minz = direction[2] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 4] - cast_point[2]) / direction[2];
    let t_maxz = direction[2] == 0 ? -1. : (nodes_bounds[node_id * BOUNDS_DATA_SIZE + 5] - cast_point[2]) / direction[2];

    let face = 0;
    let t = t_minx;

    if (t_maxx > 0 && (t_maxx < t || t < 0)) {
        t = t_maxx;
        face = 1;
    }
    if (t_miny > 0 && (t_miny < t || t < 0)) {
        t = t_miny;
        face = 2;
    }
    if (t_maxy > 0 && (t_maxy < t || t < 0)) {
        t = t_maxy;
        face = 3;
    }
    if (t_minz > 0 && (t_minz < t || t < 0)) {
        t = t_minz;
        face = 4;
    }
    if (t_maxz > 0 && (t_maxz < t || t < 0)) {
        t = t_maxz;
        face = 5;
    }

    // Return [distance to face, face intersected]
    return [t, face];
    
}

function intersectionPlanGPU(cast_point, direction, nodes_plan_point, nodes_plan_normal, node_id){
    // return [is_intersecting, distance to intersection]

    const PLAN_POINT_DATA_SIZE = 3;
    const PLAN_VEC_DATA_SIZE = 3;

    let den = direction[0] * nodes_plan_normal[node_id * 3 + 0]
            + direction[1] * nodes_plan_normal[node_id * 3 + 1]
            + direction[2] * nodes_plan_normal[node_id * 3 + 2];
    
    if (den == 0){
        return [0, 0];
    }

    let num = (nodes_plan_point[node_id * 3 + 0] - cast_point[0]) * nodes_plan_normal[node_id * 3 + 0]
            + (nodes_plan_point[node_id * 3 + 1] - cast_point[1]) * nodes_plan_normal[node_id * 3 + 1]
            + (nodes_plan_point[node_id * 3 + 2] - cast_point[2]) * nodes_plan_normal[node_id * 3 + 2];

    return [1, num/den];
}

function getNodeGPU(nodes_tresholds, nodes_childs, node_id, position){

    if (node_id < 0){
        return -1;
    }

    let next_node_id = (position[0] < nodes_tresholds[node_id * 3 + 0] ?
                            position[1] < nodes_tresholds[node_id * 3 + 1] ?
                                position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 0] : nodes_childs[node_id * 8 + 4]
                            :   position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 2] : nodes_childs[node_id * 8 + 6]
                        :   position[1] < nodes_tresholds[node_id * 3 + 1] ?
                                position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 1] : nodes_childs[node_id * 8 + 5]
                            :   position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 3] : nodes_childs[node_id * 8 + 7]);

    while (next_node_id >= 0){
        node_id = next_node_id;
        next_node_id = (position[0] < nodes_tresholds[node_id * 3 + 0] ?
                            position[1] < nodes_tresholds[node_id * 3 + 1] ?
                                position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 0] : nodes_childs[node_id * 8 + 4]
                            :   position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 2] : nodes_childs[node_id * 8 + 6]
                        :   position[1] < nodes_tresholds[node_id * 3 + 1] ?
                                position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 1] : nodes_childs[node_id * 8 + 5]
                            :   position[2] < nodes_tresholds[node_id * 3 + 2] ? nodes_childs[node_id * 8 + 3] : nodes_childs[node_id * 8 + 7]);
    }
    return node_id;
}

function castRayGPU(nodes, nodes_tresholds, nodes_childs, nodes_bounds, nodes_neighbors, nodes_lights, nodes_plan_normal,
    nodes_plan_point, materials, lights, ray_node_id, cast_point, direction, channel, max_steps){

    const MATERIAL_DATA_SIZE = 12;

    // return color

    let color = 0.

    let iteration = 0;
    let next_ray = true;
    let next_ray_node_id = ray_node_id;
    let next_ray_percentage = 1;
    let next_ray_cast_point = cast_point;
    let next_ray_direction = direction;
    
    while (next_ray && iteration < 3){
        next_ray = false;
        let node_id = getNodeGPU(nodes_tresholds, nodes_childs, next_ray_node_id, next_ray_cast_point);
        let ray_percentage = next_ray_percentage;

        if (node_id < 0){
            break;
        }

        let current_cast_point = next_ray_cast_point;
        let current_direction = next_ray_direction;
        let distance = 0.;
        let nb_steps = 0;
        let previous_node_id = -1;

        while (nb_steps < max_steps) {

            const e = 0.0001;

            //calcul de la distance avec le plan du node
            let res_plan = intersectionPlanGPU(current_cast_point, current_direction, nodes_plan_point, nodes_plan_normal, node_id);
            let t_plan = res_plan[1] + e;

            //Calcul de t la distance entre le point de cast et le bord le plus proche du node
            let res_node = intersectionNodeGPU(current_cast_point, current_direction, nodes_bounds, node_id);
            let t = res_node[0] + e;
            let face = res_node[1];

            //Point d'arrivée du ray

            let next_cast_point = [current_cast_point[0] + t * current_direction[0],
                                current_cast_point[1] + t * current_direction[1],
                                current_cast_point[2] + t * current_direction[2]];
            let next_direction = current_direction;

            let next_node_id = getNodeGPU(nodes_tresholds, nodes_childs, nodes_neighbors[node_id * 6 + face], next_cast_point);
            previous_node_id = node_id;

            if (res_plan[0] == 1 && t_plan > 0 && t_plan <= t){
                t = t_plan;

                next_cast_point = [current_cast_point[0] + t * current_direction[0],
                                current_cast_point[1] + t * current_direction[1],
                                current_cast_point[2] + t * current_direction[2]];

                next_node_id = node_id;
                previous_node_id = node_id;
            }

            if (t <= 0){
                return color;
            }

            //Pass through current node
            let plan_scal = (current_cast_point[0] - nodes_plan_point[node_id * 3 + 0]) * nodes_plan_normal[node_id * 3 + 0]
                            + (current_cast_point[1] - nodes_plan_point[node_id * 3 + 1]) * nodes_plan_normal[node_id * 3 + 1]
                            + (current_cast_point[2] - nodes_plan_point[node_id * 3 + 2]) * nodes_plan_normal[node_id * 3 + 2];
            let material_id = plan_scal < 0 ? nodes[node_id * 3 + 2] : nodes[node_id * 3 + 1];
            let transparency = materials[material_id * MATERIAL_DATA_SIZE + 3 + channel];

            let light = 0.;
            
            if (transparency <= 0.){
                let nearest_face = 0;
                let distance_to_nearest_face = Math.abs(current_cast_point[0] - nodes_bounds[node_id * 6 + 0]);

                for (let potential_nearest_face = 1; potential_nearest_face < 6; potential_nearest_face++){

                    let distance_to_face = Math.abs(current_cast_point[potential_nearest_face / 2] - nodes_bounds[node_id * 6 + potential_nearest_face]);
                    if (distance_to_face < distance_to_nearest_face){
                        distance_to_nearest_face = distance_to_face;
                        nearest_face = potential_nearest_face;
                    }
                }

                if (plan_scal >= 0 || (nodes_plan_normal[node_id * 3 + 0] == 0 && nodes_plan_normal[node_id * 3 + 1] == 0 && nodes_plan_normal[node_id * 3 + 2] == 0)){
                    light = nodes_lights[node_id * 21 + 3 * nearest_face + channel];
                } else {
                    let distance_to_plan = (nodes_plan_point[node_id * 3 + 0] - current_cast_point[0]) * nodes_plan_normal[node_id * 3 + 0]
                                        + (nodes_plan_point[node_id * 3 + 1] - current_cast_point[1]) * nodes_plan_normal[node_id * 3 + 1]
                                        + (nodes_plan_point[node_id * 3 + 2] - current_cast_point[2]) * nodes_plan_normal[node_id * 3 + 2];

                    if (distance_to_plan < distance_to_nearest_face){
                        light = nodes_lights[node_id * 21 + 18 + channel]; // lumière du plan
                    } else {
                        light = nodes_lights[node_id * 21 + 3 * nearest_face + channel];
                    }
                }
            } else if(transparency >= 1.) {
                light = 0.0;

            } else {
                for (let face=0; face < 6; face++){
                    let index_direction = face/2;
                    let F = nodes_bounds[node_id * 6 + face];
                    let A = nodes_lights[node_id * 21 + 3 * face + channel]; //light on face
    
                    let d = F - current_cast_point[index_direction] - t * (current_direction[index_direction] - 1);
                    let d0 = F - current_cast_point[index_direction];
                    let den = Math.log(transparency) * Math.abs(current_direction[index_direction] - 1);
    
                    if (d < 0){
                        if (d0 < 0){
                            light += A * Math.abs((transparency**(-d) - 2) / (den) - (transparency**(-d0) - 2) / den);
                        } else {
                            light += A * Math.abs((transparency**(-d) - 2) / (den) - (transparency**(d0)) / (-den));
                        }
                    } else {
                        if (d0 < 0){
                            light += A * Math.abs(transparency**d / (-den) - (transparency**(-d0) - 2) / den);
                        } else {
                            light += A * Math.abs(transparency**d / (-den) - (transparency**(d0)) / (-den));
                        }
                    }
                }
            }

            light *= ray_percentage * (1-transparency) * materials[material_id * MATERIAL_DATA_SIZE + channel] //diffusion
            color += light;
            ray_percentage *= transparency**t

            //color = nb_steps/max_steps;

            // check ray percentage

            if (ray_percentage <= 0.0) {
                break;
            }
    
            if (next_node_id >= 0){
                let next_material_id = nodes[next_node_id * 3 + 1];
                
                // //Reflect on next node
                // let coef_reflection = ray_percentage * materials[next_material_id+6 + channel];            
                
                // let direction_reflection = [-current_direction[0], current_direction[1], current_direction[2]];
                // if (face == 2 || face == 3) {
                //     direction_reflection = [current_direction[0], -current_direction[1], current_direction[2]];
                // } else if (face == 4 || face == 5){
                //     direction_reflection = [current_direction[0], current_direction[1], -current_direction[2]];
                // }
    
                // let t_reflection = t - 0.01;
                    
                // let cast_point_reflection = [current_cast_point[0] + t_reflection * current_direction[0],
                //                             current_cast_point[1] + t_reflection * current_direction[1],
                //                             current_cast_point[2] + t_reflection * current_direction[2]];
    
                // if (!next_ray && coef_reflection > 0.0) {
                //     ray_percentage *= (1-coef_reflection);
                //     next_ray = true;
                //     next_ray_percentage = coef_reflection;
                //     next_ray_cast_point = cast_point_reflection;
                //     next_ray_direction = direction_reflection;
                // }
    
                // // Refraction
                // //n1sin(i) = n2sin(r)
                
                // let n1 = materials[material_id+9 + channel];
                // let n2 = materials[next_material_id+9 + channel];
                // if (n2 != n1) {
                //     let normale = [1., 0., 0.];
                //     if (face == 2 || face == 3){
                //         normale = [0., 1., 0.]
                //     } else if (face == 4 || face == 5){
                //         normale = [0., 0., 1.]
                //     }
    
                //     let cosi = current_direction[0] * normale[0] + current_direction[1] * normale[1] + current_direction[2] * normale[2];
                //     if (cosi < 0.) {
                //         cosi = -cosi;
                //         normale = -normale;
                //     }
                //     let sini = Math.sqrt(1. - cosi * cosi);
                //     let sinr = n1/n2 * sini;
                //     let cosr = Math.sqrt(1. - sinr * sinr);
                    
                //     let c = (cosr * cosr + sini * sini);
                //     let normale90 = [c * current_direction[0] - cosr * normale[0],
                //                     c * current_direction[1] - cosr * normale[1],
                //                     c * current_direction[2] - cosr * normale[2]];
                //     let norme_normale90 = Math.sqrt(normale90[0] * normale90[0] + normale90[1] * normale90[1] + normale90[2] * normale90[2])
                //     normale90 = [normale90[0]/norme_normale90, normale90[1]/norme_normale90, normale90[2]/norme_normale90];
                    
                //     let direction_refraction = [cosr * normale[0] + sinr * normale90[0],
                //                                 cosr * normale[1] + sinr * normale90[1],
                //                                 cosr * normale[2] + sinr * normale90[2]];
                //     next_direction = direction_refraction;
                    
                //     // Reflection totale quand r > pi/2
                //     if (n1 > n2 && sini >= n2/n1) {
                //         next_direction = direction_reflection;
                //         next_cast_point = cast_point_reflection;
                //         next_node_id = node_id;
                //     }
                // }
    
                // Next step
                distance += t;
                current_cast_point = next_cast_point;
                current_direction = next_direction;
    
                node_id = next_node_id;
                
                nb_steps += 1;
            } else {
                break;
            }
        }
    }

    return color;
}

function renderGPU(nodes, nodes_tresholds, nodes_childs, nodes_bounds, nodes_neighbors, nodes_lights, nodes_plan_normal,
    nodes_plan_point, materials, lights, node_id, width, height, fov, u, ux, uy, position,
    diaphragme, max_steps, taille_pixel){
    
    let render_width = Math.floor(width/taille_pixel);
    let render_height = Math.floor(height/taille_pixel);

    let dx = fov * (this.thread.x - render_width/2) ;
    let dy = fov * ((render_height - this.thread.y) - render_height/2);

    let direction = [u[0] - dx * ux[0] - dy * uy[0],
                    u[1] - dx * ux[1] - dy * uy[1],
                    u[2] - dx * ux[2] - dy * uy[2]];
    let n = Math.sqrt(direction[0]*direction[0] + direction[1]*direction[1] + direction[2]*direction[2]);
    direction = [direction[0]/n, direction[1]/n, direction[2]/n]

    return diaphragme * castRayGPU(nodes, nodes_tresholds, nodes_childs, nodes_bounds, nodes_neighbors, nodes_lights, nodes_plan_normal,
        nodes_plan_point, materials, lights, node_id, [position[0], position[1], position[2]], direction, this.thread.z, max_steps);
}

function drawGPU(frame, taille_pixel){
    let x = this.thread.x/taille_pixel;
    let y = this.thread.y/taille_pixel;

    let r = frame[0][y][x];
    let g = frame[1][y][x];
    let b = frame[2][y][x];

    // let mean_color = [0, 0, 0];
    // let mean_distance_square = 0;
    // for (let k=0; k<4; k++){
    //     let i = k==0 ? -1 : k==2 ? 1 : 0;
    //     let j = k==1 ? -1 : k==3 ? 1 : 0;

    //     mean_color[0] += frame[0][y+j][x+i];
    //     mean_color[1] += frame[1][y+j][x+i];
    //     mean_color[2] += frame[2][y+j][x+i];

    //     mean_distance_square += (frame[0][y+j][x+i]-r)**2 + (frame[1][y+j][x+i]-g)**2 + (frame[2][y+j][x+i]-b)**2;
    // }

    // mean_color[0] /= 4;
    // mean_color[1] /= 4;
    // mean_color[2] /= 4;
    // mean_distance_square /= 4;

    // const max_distance = 0.5;
    // if (mean_distance_square > max_distance * max_distance){
    //     r = mean_color[0];
    //     g = mean_color[1];
    //     b = mean_color[2];

    //     // r = 1;
    //     // g = 0;
    //     // b = 0;
    // }

    // const seuil = 0.2;

    // if (r < seuil && g < seuil && b < seuil){
    //     r = frame[0][y][x-1];
    //     g = frame[1][y][x-1];
    //     b = frame[2][y][x-1];

    //     // r = 1;
    //     // g = 0;
    //     // b = 0;
    // }

    this.color(r, g, b, 1);
}

// Classes

class Light{
    static next_gpu_id = 0;
    constructor(power, color, position){
        this.power = power;
        this.color = color;
        this.position = position;
        this.gpu_id = -1;
    }

    toArray(){
        let result = [this.power];
        result = result.concat(this.color);
        result = result.concat(this.position);

        return result;
    }
}

class Material{
    static next_gpu_id = 0;
    constructor(diffusion, transparency, reflection, refraction){
        this.diffusion = diffusion; // diffusion pour chaque couleur, entre 0 (transparent) et 1 (opaque)
        this.transparency = transparency;
        this.reflection = reflection; // entre 0 et 1
        this.refraction = refraction; //n1*sin(i) = n2*sin(r)
        this.gpu_id = -1;
    }

    toArray(){
        let result = this.diffusion;
        result = result.concat(this.transparency);
        result = result.concat(this.reflection);
        result = result.concat(this.refraction);

        return result //[r, g, b, transparency, reflection, refraction]
    }
}

class Node{
    static next_gpu_id = 0;
    constructor(parent, child_index, material, plan_material, plan_vec = [0,0,0], plan_point=[0,0,0], tresholds=[0,0,0], childs = [null, null, null, null, null, null, null, null]){
        this.depth = parent == null ? 0 : parent.depth + 1;
        
        this.gpu_id = -1;
        this.parent = parent;
        this.material = material;
        this.tresholds = tresholds;
        this.childs = childs;

        this.child_index = child_index;
        this.light_in = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // each face has an amount of light comming in, we store only the flux i.e amount of light / surface
        this.light_out = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // each face has an amount of light comming out, we store only the flux i.e amount of light / surface
        this.bounds = [-WORLD_SIZE, WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE];
        this.neighbors = [null, null, null, null, null, null];

        this.plan_material = plan_material;
        this.plan_vec = plan_vec;
        this.plan_point = plan_point;
    }

    toArray(){
        let result = [];

        if (this.parent == null){ // 0
            result.push(-1);
        } else {
            result.push(this.parent.gpu_id);
        }

        result.push(this.material.gpu_id); // 1

        for (let treshold of this.tresholds){ // 2
            result.push(treshold);
        }

        for (let child of this.childs){ // 5
            result.push(child == null ? -1 : child.gpu_id);
        }

        for (let bound of this.bounds){ // 13
            result.push(bound);
        }

        for (let neighbor of this.neighbors){ // 19
            result.push(neighbor == null ? -1 : neighbor.gpu_id);
        }

        for (let light of this.light_in){ // 25
            result.push(light);
        }
        
        result.push(this.plan_material == null ? -1 : this.plan_material.gpu_id); // 46
        result.push(this.plan_point[0]); // 47
        result.push(this.plan_point[1]);
        result.push(this.plan_point[2]);
        result.push(this.plan_vec[0]); // 50
        result.push(this.plan_vec[1]);
        result.push(this.plan_vec[2]);

        return result
    }

    update_bounds_and_neighbors(){
        this.bounds = this.parent != null ? [...this.parent.bounds] : [-WORLD_SIZE, WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE];
        this.neighbors = [...this.parent.neighbors];
        switch (this.child_index){
            case 0:
                this.bounds[1] = this.parent.tresholds[0];
                this.bounds[3] = this.parent.tresholds[1];
                this.bounds[5] = this.parent.tresholds[2];
                this.neighbors[1] = this.parent.childs[1];
                this.neighbors[3] = this.parent.childs[2];
                this.neighbors[5] = this.parent.childs[4];
                break;
            case 1:
                this.bounds[0] = this.parent.tresholds[0];
                this.bounds[3] = this.parent.tresholds[1];
                this.bounds[5] = this.parent.tresholds[2];
                this.neighbors[0] = this.parent.childs[0];
                this.neighbors[3] = this.parent.childs[3];
                this.neighbors[5] = this.parent.childs[5];
                break;
            case 2:
                this.bounds[1] = this.parent.tresholds[0];
                this.bounds[2] = this.parent.tresholds[1];
                this.bounds[5] = this.parent.tresholds[2];
                this.neighbors[1] = this.parent.childs[3];
                this.neighbors[2] = this.parent.childs[0];
                this.neighbors[5] = this.parent.childs[6];
                break;
            case 3:
                this.bounds[0] = this.parent.tresholds[0];
                this.bounds[2] = this.parent.tresholds[1];
                this.bounds[5] = this.parent.tresholds[2];
                this.neighbors[0] = this.parent.childs[2];
                this.neighbors[2] = this.parent.childs[1];
                this.neighbors[5] = this.parent.childs[7];
                break;
            case 4:
                this.bounds[1] = this.parent.tresholds[0];
                this.bounds[3] = this.parent.tresholds[1];
                this.bounds[4] = this.parent.tresholds[2];
                this.neighbors[1] = this.parent.childs[5];
                this.neighbors[3] = this.parent.childs[6];
                this.neighbors[4] = this.parent.childs[0];
                break;
            case 5:
                this.bounds[0] = this.parent.tresholds[0];
                this.bounds[3] = this.parent.tresholds[1];
                this.bounds[4] = this.parent.tresholds[2];
                this.neighbors[0] = this.parent.childs[4];
                this.neighbors[3] = this.parent.childs[7];
                this.neighbors[4] = this.parent.childs[1];
                break;
            case 6:
                this.bounds[1] = this.parent.tresholds[0];
                this.bounds[2] = this.parent.tresholds[1];
                this.bounds[4] = this.parent.tresholds[2];
                this.neighbors[1] = this.parent.childs[7];
                this.neighbors[2] = this.parent.childs[4];
                this.neighbors[4] = this.parent.childs[2];
                break;
            case 7:
                this.bounds[0] = this.parent.tresholds[0];
                this.bounds[2] = this.parent.tresholds[1];
                this.bounds[4] = this.parent.tresholds[2];
                this.neighbors[0] = this.parent.childs[6];
                this.neighbors[2] = this.parent.childs[5];
                this.neighbors[4] = this.parent.childs[3];
                break;
        }
    }

    divide(materials){
        this.tresholds = [(this.bounds[1]+this.bounds[0])/2,
                        (this.bounds[3]+this.bounds[2])/2,
                        (this.bounds[5]+this.bounds[4])/2];

        this.childs[0] = new Node(this, 0, materials[0], materials[0]);
        this.childs[1] = new Node(this, 1, materials[1], materials[1]);
        this.childs[2] = new Node(this, 2, materials[2], materials[2]);
        this.childs[3] = new Node(this, 3, materials[3], materials[3]);
        this.childs[4] = new Node(this, 4, materials[4], materials[4]);
        this.childs[5] = new Node(this, 5, materials[5], materials[5]);
        this.childs[6] = new Node(this, 6, materials[6], materials[6]);
        this.childs[7] = new Node(this, 7, materials[7], materials[7]);

        this.childs[0].update_bounds_and_neighbors();
        this.childs[1].update_bounds_and_neighbors();
        this.childs[2].update_bounds_and_neighbors();
        this.childs[3].update_bounds_and_neighbors();
        this.childs[4].update_bounds_and_neighbors();
        this.childs[5].update_bounds_and_neighbors();
        this.childs[6].update_bounds_and_neighbors();
        this.childs[7].update_bounds_and_neighbors();
    }

    fusion(){
        this.tresholds=[0,0,0]
        this.childs = [null, null, null, null, null, null, null, null];
    }

    intersection(point, direction){
        let t_minx = direction[0] == 0 ? -1. : (this.bounds[0] - point[0]) / direction[0];
        let t_maxx = direction[0] == 0 ? -1. : (this.bounds[1] - point[0]) / direction[0];
        let t_miny = direction[1] == 0 ? -1. : (this.bounds[2] - point[1]) / direction[1];
        let t_maxy = direction[1] == 0 ? -1. : (this.bounds[3] - point[1]) / direction[1];
        let t_minz = direction[2] == 0 ? -1. : (this.bounds[4] - point[2]) / direction[2];
        let t_maxz = direction[2] == 0 ? -1. : (this.bounds[5] - point[2]) / direction[2];
    
        let face = 0;
        let t = t_minx;
    
        if (t_maxx > 0 && (t_maxx < t || t < 0)) {
            t = t_maxx;
            face = 1;
        }
        if (t_miny > 0 && (t_miny < t || t < 0)) {
            t = t_miny;
            face = 2;
        }
        if (t_maxy > 0 && (t_maxy < t || t < 0)) {
            t = t_maxy;
            face = 3;
        }
        if (t_minz > 0 && (t_minz < t || t < 0)) {
            t = t_minz;
            face = 4;
        }
        if (t_maxz > 0 && (t_maxz < t || t < 0)) {
            t = t_maxz;
            face = 5;
        }
    
        // Return [distance to face, face intersected]
        return [t, face];
    }

    is_in(position){
        return position[0] > this.bounds[0] && position[0] < this.bounds[1]
            && position[1] > this.bounds[2] && position[1] < this.bounds[3]
            && position[2] > this.bounds[4] && position[2] < this.bounds[5];
    }

    get_center(){
        return [(this.bounds[0] + this.bounds[1])/2, (this.bounds[2] + this.bounds[3])/2, (this.bounds[4] + this.bounds[5])/2]
    }

    distance_from(position){
        let center = this.get_center();

        if (this.is_in(position)){
            return 0;
        }

        let u = [center[0]-position[0], center[1]-position[1], center[2]-position[2]];
        let norm = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
        u[0] /= norm;
        u[1] /= norm;
        u[2] /= norm;

        let t_min = -Infinity;
        let t_max = Infinity;

        if (u[0] > 0){
            t_min = Math.max(t_min, (this.bounds[0] - position[0])/u[0]);
            t_max = Math.min(t_max, (this.bounds[1] - position[0])/u[0]);
        } else {
            t_min = Math.max(t_min, (this.bounds[1] - position[0])/u[0]);
            t_max = Math.min(t_max, (this.bounds[0] - position[0])/u[0]);
        }

        if (u[1] > 0){
            t_min = Math.max(t_min, (this.bounds[2] - position[1])/u[1]);
            t_max = Math.min(t_max, (this.bounds[3] - position[1])/u[1]);
        } else {
            t_min = Math.max(t_min, (this.bounds[3] - position[1])/u[1]);
            t_max = Math.min(t_max, (this.bounds[2] - position[1])/u[1]);
        }

        if (u[2] > 0){
            t_min = Math.max(t_min, (this.bounds[4] - position[2])/u[2]);
            t_max = Math.min(t_max, (this.bounds[5] - position[2])/u[2]);
        } else {
            t_min = Math.max(t_min, (this.bounds[5] - position[2])/u[2]);
            t_max = Math.min(t_max, (this.bounds[4] - position[2])/u[2]);
        }

        return t_min;
    }
}

class Camera{
    constructor(width, height, element_to_add_canvas, fov=1, max_steps=10, taille_pixel=1){
        this.width = width;
        this.height = height;

        this.position = [0.0,0.0,0.0];
        this.teta = 0.0;
        this.phi = Math.PI/2.0;

        this.fov = fov/1000;
        this.diaphragme = 1;
        this.max_steps = max_steps;
        this.taille_pixel = taille_pixel;

        this.u = new Array(3);
        this.ux = new Array(3);
        this.uy = new Array(3);

        this.update();

        this.gpu = new GPU();
        this.gpu.addFunction(intersectionNodeGPU);
        this.gpu.addFunction(castRayGPU);
        this.gpu.addFunction(getNodeGPU);
        this.gpu.addFunction(intersectionPlanGPU);
        
        this.render = this.gpu.createKernel(renderGPU)
        .setOutput([Math.floor(width/taille_pixel), Math.floor(height/taille_pixel), 3])
        .setDynamicArguments(true)
        .setPipeline(true);
        this.render.immutable = true;
        
        this.draw = this.gpu.createKernel(drawGPU)
        .setOutput([width, height])
        .setGraphical(true)

        this.frame = null;

        element_to_add_canvas.appendChild(this.draw.canvas);
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

    drawFrame(nodes, nodes_tresholds, nodes_childs, nodes_bounds, nodes_neighbors, nodes_lights, nodes_plan_normal,
        nodes_plan_point, materials, lights, node_id){
        
        if (this.frame != null){
            this.frame.delete();
        }
        
        this.frame = this.render(nodes, nodes_tresholds, nodes_childs, nodes_bounds, nodes_neighbors, nodes_lights,
            nodes_plan_normal, nodes_plan_point, materials, lights, node_id,
            this.width, this.height, this.fov,
            this.u, this.ux, this.uy,
            this.position, this.diaphragme, this.max_steps, this.taille_pixel);
        
        this.draw(this.frame, this.taille_pixel);
    }
}

class TreeMatterEngine{
    constructor(camera, world_node, lights){

        this.camera = camera;
        this.lights = lights;
        this.world_node = world_node;
        this.current_node = this.get_node();

        this.process_light(this.world_node);

        this.nodes_on_gpu = [];

        this.materials_array = [];
        this.nodes_array = [];
        this.nodes_tresholds_array = [];
        this.nodes_childs_array = [];
        this.nodes_bounds_array = [];
        this.nodes_neighbors_array = [];
        this.nodes_lights_array = [];
        this.nodes_plan_normal_array = [];
        this.nodes_plan_point_array = [];

        this.texture_lights_array = null;
        this.texture_materials_array = null;
        this.texture_nodes_array = null;
        this.texture_nodes_tresholds_array = null;
        this.texture_nodes_childs_array = null;
        this.texture_nodes_bounds_array = null;
        this.texture_nodes_neighbors_array = null;
        this.texture_nodes_lights_array = null;
        this.texture_nodes_plan_normal_array = null;
        this.texture_nodes_plan_point_array = null;

        this.create_texture = this.camera.gpu.createKernel(function(array){
            return array[this.thread.x];
        }).setOutput([1]).setPipeline(true).setDynamicOutput(true).setDynamicArguments(true);
        this.create_texture.immutable = true;

        // this.set_texture = this.camera.gpu.createKernel(function(texture, array, start_index, array_size){
        //     if (this.thread.x >= start_index && this.thread.x < start_index + array_size){
        //         return array[this.thread.x - start_index];
        //     }
        //     return texture[this.thread.x];
        // }).setOutput([1]).setPipeline(true).setDynamicOutput(true).setDynamicArguments(true);
        // this.set_texture.immutable = true;

        this.rebuild();
    }

    set_textures(){

        if (this.texture_lights_array != null){
            this.texture_lights_array.delete();
        }
        if (this.texture_nodes_array != null){
            this.texture_nodes_array.delete();
        }
        if (this.texture_materials_array != null){
            this.texture_materials_array.delete();
        }

        this.create_texture.setOutput([this.lights_array.length]); 
        this.texture_lights_array = this.create_texture(this.lights_array);

        this.create_texture.setOutput([this.materials_array.length]);
        this.texture_materials_array = this.create_texture(this.materials_array);

        console.log(this.texture_materials_array.toArray());

        // nodes
        this.create_texture.setOutput([this.nodes_array.length]);
        this.texture_nodes_array = this.create_texture(this.nodes_array);

        this.create_texture.setOutput([this.nodes_tresholds_array.length]);
        this.texture_nodes_tresholds_array = this.create_texture(this.nodes_tresholds_array);

        this.create_texture.setOutput([this.nodes_childs_array.length]);
        this.texture_nodes_childs_array = this.create_texture(this.nodes_childs_array);

        this.create_texture.setOutput([this.nodes_bounds_array.length]);
        this.texture_nodes_bounds_array = this.create_texture(this.nodes_bounds_array);

        this.create_texture.setOutput([this.nodes_neighbors_array.length]);
        this.texture_nodes_neighbors_array = this.create_texture(this.nodes_neighbors_array);

        this.create_texture.setOutput([this.nodes_lights_array.length]);
        this.texture_nodes_lights_array = this.create_texture(this.nodes_lights_array);

        this.create_texture.setOutput([this.nodes_plan_normal_array.length]);
        this.texture_nodes_plan_normal_array = this.create_texture(this.nodes_plan_normal_array);

        this.create_texture.setOutput([this.nodes_plan_point_array.length]);
        this.texture_nodes_plan_point_array = this.create_texture(this.nodes_plan_point_array);
    }

    set_camera_position(position){
        this.camera.position = position;
        this.current_node = this.get_node();
    }

    set_camera_orientation(teta, phi){
        this.camera.teta = teta;
        this.camera.phi = phi;
        this.camera.update();
    }

    get_node(){
        let position = this.camera.position;
        let node = this.world_node;
        let next_node = position[0] < node.tresholds[0] ?
                            position[1] < node.tresholds[1] ?
                                position[2] < node.tresholds[2] ? node.childs[0] : node.childs[4]
                            :   position[2] < node.tresholds[2] ? node.childs[2] : node.childs[6]
                        :   position[1] < node.tresholds[1] ?
                                position[2] < node.tresholds[2] ? node.childs[1] : node.childs[5]
                            :   position[2] < node.tresholds[2] ? node.childs[3] : node.childs[7]

        while (next_node != null){
            node = next_node;
            next_node = position[0] < node.tresholds[0] ?
                                position[1] < node.tresholds[1] ?
                                    position[2] < node.tresholds[2] ? node.childs[0] : node.childs[4]
                                :   position[2] < node.tresholds[2] ? node.childs[2] : node.childs[6]
                            :   position[1] < node.tresholds[1] ?
                                    position[2] < node.tresholds[2] ? node.childs[1] : node.childs[5]
                                :   position[2] < node.tresholds[2] ? node.childs[3] : node.childs[7]
        }
        return node;
    }

    build_arrays(){
        Material.next_gpu_id = 0;
        Node.next_gpu_id = 0;
        Light.next_gpu_id = 0;

        // Réinitialisation
        for (let gpu_node of this.nodes_on_gpu){
            gpu_node.gpu_id = -1;
            if (gpu_node.material != null){
                gpu_node.material.gpu_id = -1;
            }
        }
        this.nodes_on_gpu = [];

        this.lights_array = [];
        this.materials_array = [];
        this.nodes_array = [];
        this.nodes_childs_array = [];
        this.nodes_bounds_array = [];
        this.nodes_neighbors_array = [];
        this.nodes_lights_array = [];
        this.nodes_plan_normal_array = [];
        this.nodes_plan_point_array = [];

        // adding world node to GPU
        this.add_node_to_array(this.world_node);
        
        if (this.lights_array.length == 0){
            this.lights_array = [[0]];
        }
    }

    add_node_to_array(node){

        // material
        if (node.material.gpu_id < 0){ // Si le material n'est pas déjà ajoutée
            node.material.gpu_id = Material.next_gpu_id;
            Material.next_gpu_id + 1;
            let material_array = node.material.toArray();
            for (let k=0; k<material_array.length; k++){
                this.materials_array.push(material_array[k]);
            }
            
        }

        // plan material
        if (node.plan_material != null && node.plan_material.gpu_id < 0){ // Si le material n'est pas déjà ajoutée
            node.plan_material.gpu_id = Material.next_gpu_id;
            Material.next_gpu_id += 1;
            let material_array = node.plan_material.toArray();
            for (let k=0; k<material_array.length; k++){
                this.materials_array.push(material_array[k]);
            }
        }

        //node
        this.nodes_on_gpu.push(node);

        //create data space
        node.gpu_id = Node.next_gpu_id;
        Node.next_gpu_id += 1;


        this.nodes_array.push(node.parent == null ? -1 : node.parent.gpu_id);
        this.nodes_array.push(node.material.gpu_id);
        this.nodes_array.push(node.plan_material.gpu_id);

        for (let k=0; k<3; k++){
            this.nodes_tresholds_array.push(node.tresholds[k]);
        }
        for (let k=0; k<8; k++){
            this.nodes_childs_array.push(node.childs[k] == null ? -1 : node.childs[k].gpu_id);
        }
        for (let k=0; k<6; k++){
            this.nodes_bounds_array.push(node.bounds[k]);
        }
        for (let k=0; k<6; k++){
            this.nodes_neighbors_array.push(node.neighbors[k] == null ? -1 : node.neighbors[k].gpu_id);
        }
        for (let k=0; k<21; k++){
            this.nodes_lights_array.push(node.light_in[k]);
        }
        for (let k=0; k<3; k++){
            this.nodes_plan_normal_array.push(node.plan_vec[k]);
        }
        for (let k=0; k<3; k++){
            this.nodes_plan_point_array.push(node.plan_point[k]);
        }

        

        //childs
        for (let child of node.childs){
            if (child != null && child.gpu_id < 0){
                this.add_node_to_array(child);
            }
        }

        //neighbors
        for (let neighbor of node.neighbors){
            if (neighbor != null && neighbor.gpu_id < 0){
                this.add_node_to_array(neighbor);
            }
        }

        //update gpu_id of childs ad neighbors

        for (let k=0; k<8; k++){
            this.nodes_childs_array[node.gpu_id * 8 + k] = node.childs[k] == null ? -1 : node.childs[k].gpu_id;
        }
        for (let k=0; k<6; k++){
            this.nodes_neighbors_array[node.gpu_id * 6 + k] = node.neighbors[k] == null ? -1 : node.neighbors[k].gpu_id;
        }
    }

    render(){
        this.camera.drawFrame(this.texture_nodes_array, this.texture_nodes_tresholds_array, this.texture_nodes_childs_array, this.texture_nodes_bounds_array,
            this.texture_nodes_neighbors_array, this.texture_nodes_lights_array, this.texture_nodes_plan_normal_array,
            this.texture_nodes_plan_point_array, this.texture_materials_array, this.texture_lights_array,
            this.current_node.gpu_id);
    }

    process_light(node){
        if (node == null){
            return;
        }

        let center = node.get_center();
        let dx = (node.bounds[1] - node.bounds[0])/2;
        let dy = (node.bounds[3] - node.bounds[2])/2;
        let dz = (node.bounds[5] - node.bounds[4])/2;

        node.light_in = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

        for (let light of this.lights){
            for (let face=0; face < 6; face++){
                for (let channel=0; channel<3; channel++){
    
                    let center_face = [center[0] + dx * (face==0?-1: face==1?1:0), center[1] + dy * (face==2?-1: face==3?1:0), center[2] + dz * (face==4?-1: face==5?1:0)];
                    let u = [light.position[0] - center_face[0], light.position[1] - center_face[1], light.position[2] - center_face[2]];
                    let d = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
                    let v = [face==0?-1: face==1?1: 0, face==2?-1: face==3?1: 0, face==4?-1: face==5?1: 0];
                    let scal = u[0]*v[0]/d + u[1]*v[1]/d + u[2]*v[2]/d;
    
                    if (scal > 0){
                        node.light_in[3*face + channel] += scal * light.power * light.color[channel]/ (d*d);
                    }
                    
                }
            }

            //plan
            for (let channel=0; channel<3; channel++){
                let center_face = node.plan_point;
                let u = [light.position[0] - center_face[0], light.position[1] - center_face[1], light.position[2] - center_face[2]];
                let d = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
                let v = node.plan_vec;
                let scal = u[0]*v[0]/d + u[1]*v[1]/d + u[2]*v[2]/d;

                if (scal > 0){
                    node.light_in[18 + channel] += scal * light.power * light.color[channel]/ (d*d);
                }
            }
        }
        
        for (let child of node.childs){
            this.process_light(child);
        }
    }

    set_child(node, child, index){
        child.parent = node;
        if (index == 0){
            node.childs[0] = child;
        } else {
            node.childs[1] = child;
        }
    
        if (node.gpu_id >= 0){ //Si le node est présent sur le GPU
            // update light
            this.process_light(node);

            //update les données du GPU
            if (child.gpu_id < 0){ //si le node n'est pas sur le GPU on l'ajoute
                this.add_node_to_array(child);
            }
        }
    }

    remove_node_from(node, index){
        if (index == 0){
            node.childs[0] = null;
        } else {
            node.childs[1] = null;
        }

        if (node.parent != null && node.parent.gpu_id >= 0 && node.gpu_id >= 0){ // si le parent node est sur le GPU on supprime aussi sur le GPU
            // let inner_nodes_id = this.nodes_array[parent_node.gpu_id][26]
            // let inner_nodes_list = this.inner_nodes_array[inner_nodes_id]
            
            // for (let k=0; k < inner_nodes_list[0]; k++){
            //     if (inner_nodes_list[1 + k] == node.gpu_id){
            //         inner_nodes_list.splice(k, 1);
            //         //inner_nodes_list[0] -= 1;
            //         break;
            //     }
            // }

            this.rebuild();
        }
    }

    set_material(node, material){
        node.material = material;

        if (node.gpu_id >= 0){ //si le node est sur le GPU on update le GPU
            // material
            if (node.material.gpu_id < 0){ // Si le material n'est pas sur le GPU on l'ajoute
                node.material.gpu_id = this.materials_array.length;
                let material_array = node.material.toArray();
                for(let k=0; k<material_array.length; k++){
                    this.materials_array.push(material_array[k]);
                }
            }

            this.nodes_array[node.gpu_id + 5] = node.material.gpu_id;
        }
    }

    update(){
        this.set_textures();

        this.render();
        this.camera.render.canvas.width = this.camera.width;
        this.camera.render.canvas.height = this.camera.height;
    }

    rebuild(){
        this.process_light(this.world_node);
        this.build_arrays();
        this.update();
    }
}

export {Light, Material, Node, Camera, TreeMatterEngine}
