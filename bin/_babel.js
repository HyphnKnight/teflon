const
	log = require('log'),
	transform = require ( 'babel-core' ).transform;

module.exports = function babel ( buffer, path ) {

	log.runningTask( 'transform' , 'babel' , path , __filename);

	try { return transform( buffer , { presets : ['es2015'] } ).code; }
	catch ( error ) {

		log.error( `babel.transform has failed to parse the buffer for ${path}` , __filename , error );

		process.exit(1);

	}

};