
function pow(x, y){
    if (y==Infinity){
        if (x<1){
            return 0
        } else if (x == 1){
            return 1
        } else {
            return Infinity
        }
    } else {
        return x**y;
    }

}

function add(u, v){
    return [u[0]+v[0], u[1]+v[1], u[2]+v[2]];
}

function substract(u,v){
    return [u[0]-v[0], u[1]-v[1], u[2]-v[2]];
}

function mul(a, u){
    return [a*u[0], a*u[1], a*u[2]];
}

function scal(u, v){
    return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
}

function normalize(u){
    let norme = Math.sqrt(scal(u,u));
    return [u[0]/norme, u[1]/norme, u[2]/norme];
}

function drawSegment(ctx, color, A, B){
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A[0],A[1]);
    ctx.lineTo(B[0],B[1]);
    ctx.stroke();
}

function drawBackground(ctx, color){
    ctx.fillStyle = color;
    ctx.fillRect(0,0,ctx.canvas.clientWidth,ctx.canvas.clientHeight);
}

function drawRect(ctx, color, x, y, width, height){
    ctx.fillStyle = color;
    ctx.fillRect(x,y, width,height);
}

function intersectLines(A, u, B, v){

    let d = u[0] * v[1] - u[1] * v[0];

    if (d != 0){
        let x0 = (u[0]*v[0]*A[1] - v[0]*u[1]*A[0] + u[0]*v[1]*B[0] - u[0]*v[0]*B[1])/d;
        let y0 = (u[0]*v[1]*A[1] - v[1]*u[1]*A[0] + u[1]*v[1]*B[0] - u[1]*v[0]*B[1])/d;

        return [x0, y0];
    }
}
