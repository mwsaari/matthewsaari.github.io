/*global document, THREE, setInterval, setTimeout, requestAnimationFrame, waitTime, console, $V, Sphere*/ 

/** 
 *   I am using Three.js, a webgl library: http://threejs.org/
 *   I used this as my starting code: https://aerotwist.com/tutorials/getting-started-with-three-js/
 *   That contained the basics of setting up a scene, camera, light, and object
 * 
 *   For vector operations I am using Sylvestor.js http://sylvester.jcoglan.com/
 *    
 *   @author: Kade Keith
 */

var doc = document; //shorthand

var SCENE_WIDTH = 620;
var SCENE_HEIGHT = 620;
var CUBE_LEN = 10;

var VIEW_ANGLE = 45;
var ASPECT = SCENE_WIDTH / SCENE_HEIGHT;
var NEAR = 0.1;
var FAR = 10000;

var RADIUS = 1; //radius of sphere in meters

//we have six planes that we check for collision, defined by a point and the normal. 
//this data structure could be optimized
var planes = [
    {
        p: $V([0,RADIUS,0]), //bottom
        n: $V([0,1,0])
    }, 
    {
        p: $V([0,CUBE_LEN-RADIUS,0]), //top
        n: $V([0,-1,0])
    }, 
    {
        p: $V([0,0,CUBE_LEN-RADIUS]), //front
        n: $V([0,0,-1])
    }, 
    {
        p: $V([0,0,RADIUS]), //back
        n: $V([0,0,1])
    }, 
    {
        p: $V([RADIUS,0,0]), //left
        n: $V([1,0,0]),
        id: 'temp'
    }, 
    {
        p: $V([CUBE_LEN-RADIUS,0,0]), //right
        n: $V([-1,0,0]),
    }
];

/** create the renderer and add it to the scene */
function initRenderer(){
    var renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setClearColor(0xD4D4D4 , 1); //make the background grey

    renderer.setSize(SCENE_WIDTH, SCENE_HEIGHT);
    doc.getElementById('webgl-container').appendChild(renderer.domElement);
    return renderer;
}

/** create the camera and add it to the scene */
function initCamera(){
    var camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);

    camera.position.set(CUBE_LEN*2.1, CUBE_LEN*2.1, CUBE_LEN*2.6);

    camera.lookAt(new THREE.Vector3(0,0,0)); //we want to focus on the center always
    
    scene.add(camera);
    return camera;
}
    
/** create the point light and add it to the scene */
function initLight(){
    var pointLight = new THREE.PointLight(0x0000FF); // blue
    pointLight.position.set (CUBE_LEN/2, CUBE_LEN/2, 300);

    scene.add(pointLight);
    return pointLight;
}

/** 
 *  create the box and add it to the scene 
 *  What happens here is that I create both the box (mesh) and a box helper that 
 *  is the bounding box of that mesh. I set the original box to not be visible, leaving just the edges
 */
function initCube(){
    var geometry = new THREE.BoxGeometry(CUBE_LEN, CUBE_LEN, CUBE_LEN);
    var material = new THREE.MeshBasicMaterial( {color: 0x000000} );
    var mesh = new THREE.Mesh( geometry, material );
    mesh.visible = false;
    mesh.position.set(CUBE_LEN/2, CUBE_LEN/2, CUBE_LEN/2);

    var box = new THREE.BoxHelper( mesh );
    box.material.color.set( 0xff0000 );
    
    scene.add(mesh);
    scene.add(box);
    return box;
}

var scene = new THREE.Scene();
var renderer = initRenderer();
var camera = initCamera();
var light = initLight();
var cube = initCube();

/************* Assignment specific code begins here *************/

//variables that the user will be able to adjust
var G = new $V([0, -9.81, 0]);  // The accel due to gravity in m/s^2 
var D = 0.4;                    // Air resitence
var H = 0.01;                   // Step time in seconds
var H_MILLI = H * 1000;         // In milliseconds
var CR = 0.5;                   // coefficient of restitution
var CF = 0.5;                   // coefficient of TODO

var minCollisionV = 1;          // TODO
var minCollisionX = 1;          // TODO

var initialX = {x: CUBE_LEN/2, y: CUBE_LEN/2, z: CUBE_LEN/2};
var initialV = {x: 60, y: 16, z: -21};

function getUserInputs(){
    initialX.x = parseInt(doc.getElementById("p.x").value);
    initialX.y = parseInt(doc.getElementById("p.y").value);
    initialX.z = parseInt(doc.getElementById("p.z").value);

    initialV.x = parseInt(doc.getElementById("v.x").value);
    initialV.y = parseInt(doc.getElementById("v.y").value);
    initialV.z = parseInt(doc.getElementById("v.z").value);    
}

var sphere, clock;
function initMotion(){
    getUserInputs();
    if (sphere){
        scene.remove(sphere.visual);
    }
    
    //TODO breaks on [60, 16, -20]. not sure if it a rounding error or what
    sphere = new Sphere(scene, [initialX.x, initialX.y, initialX.z], [initialV.x, initialV.y, initialV.z], RADIUS);
    clock = new THREE.Clock();
    clock.start();
    clock.getDelta();
    simulate();
    render();
}
initMotion();

function integrate(v1, v2, timestep){
    return v1.add(v2.multiply(timestep));
}

function simulate(){
    
    var timestepRemain = H;
    var timestep = timestepRemain; // We try to simulate a full timestep 
    while (timestepRemain > 0) {
        
        //Euler integration for acceleration due to gravity accounting for air resistence
        //a = g - (d/m)v
        var acceleration = G.subtract(sphere.v.multiply(D/sphere.mass));
        
        var vNew = integrate(sphere.v, acceleration, timestep);
        var xNew = integrate(sphere.x, sphere.v, timestep);
        
        //old just gravity
        //var vNew = sphere.v.add(G.multiply(H));
        
        var collision = collisionFraction(sphere.x, xNew);
        if (collision){

            //If the ball is at rest stop simulation
            if (atRest(vNew, xNew, acceleration, collision)){
                return;    
            }
            
            timestep = collision.fraction * timestep;
            vNew = integrate(sphere.v, acceleration, timestep);            
            
            vNew = collisionResponse(vNew, collision.normal);
            xNew = integrate(sphere.x, sphere.v, timestep);
        }
        
        timestepRemain = timestepRemain - timestep;

        sphere.v = vNew;
        sphere.x = xNew;
        sphere.visual.position.set(xNew.elements[0], xNew.elements[1], xNew.elements[2]);
    }
        
    var waitTime = H_MILLI - clock.getDelta(); 

    //4 milliseconds is the minimum wait 
    //https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setTimeout#Minimum_delay_and_timeout_nesting
    if (waitTime < 4){
        console.log("simulation getting behind and slowing down!");
    }
    setTimeout(simulate, waitTime);
}

/** rendering loop */
function render() {	
    renderer.render(scene, camera); //draw it
	requestAnimationFrame(render);  //redraw whenever the browser refreshes
}
 

/** Detects at what fraction a collision occurs. Returns false if there is no collision. */
function collisionFraction(x1, x2){
    
    for (var i = 0; i < planes.length; i++){
        var plane = planes[i];
        var dOld = x1.subtract(plane.p).dot(plane.n);
        var dNew = x2.subtract(plane.p).dot(plane.n);
                    
        //check if they have the same sign
        //if dOld is zero then a collision just happened and we don't want to detect it again
        if (dOld*dNew > 0 || dOld === 0){
            continue;
        }
        else {
            return { 
                fraction: dOld / (dOld-dNew),
                normal: plane.n,
                point: plane.p
            };
        }
    }
    
    return false;
}

function collisionResponse(vOld, n){
    var vNormalOld = n.multiply(vOld.dot(n));
    var vTanOld = vOld.subtract(vNormalOld);

    var vNormalNew = n.multiply(-1 * CR * (vOld.dot(n)));
    //TODO use the coulomb 
    var vTanNew = vOld.subtract(vNormalOld).multiply(1-CF);
    
    return vNormalNew.add(vTanNew);
}

/**
 * Criteria for it being at rest.
 * 1. velocity less than minCollisionV
 * 2. dist less than minCollisionX
 * 3. acceleration is away from the surface
 */
function atRest(v, x, a, collision){
    var dist = x.subtract(collision.point).dot(collision.normal);
    if (magnitude(v) < minCollisionV && dist < minCollisionX && a.dot(collision.normal) < 0){
        return true;
    }
    return false;
}

/**
 *  Strangely, Sylvester doesn't have magnitude. That or I am blind and couldn't find it in the API docs.
 */
function magnitude(v){
    var sum = 0;
    for (var i = 0; i < v.elements.length; i++){
        sum += Math.pow(v.elements[i], 2);
    }
    return Math.sqrt(sum);
}

