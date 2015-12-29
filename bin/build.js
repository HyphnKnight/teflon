'use strict';

const

	/* Custom Modules */

	glob			= require( './_glob.js' ),
	compile			= require( './_compile.js' ),
	assembleModule	= require( './_assembleModule.js' ),
	packageModule	= require( './_packageModule.js' ),
	vulcanize		= require( './_vulcanize.js' ),


	/* Build Modules */

	rsvp	= require('rsvp'),
	log		= require('log'),
	_		= require('underscore'),
	express	= require ( 'express' ),
	path	= require( 'path' ),
	fs		= require( 'fs-extra-promise' ),
	watcher	= require( 'node-watch' ),


	/* Arguments Parsing */

	args = process.argv.slice(2),
	compress	= _.contains( args , '--c' ) || _.contains( args , '--compress' ),
	serve		= _.contains( args , '--s' ) || _.contains( args , '--server' ),
	watch		= _.contains( args , '--w' ) || _.contains( args , '--watch' ),
	debug		= _.contains( args , '--d' ) || _.contains( args , '--debug' ),
	port = ( ( ) => {
		const port = (_.find( args , ( arg ) => { return arg.search('--p=') !== -1 } ));
		if ( _.isUndefined( port ) ) return process.env.PORT ? process.env.PORT : 8000;
		else return Number( port.substr( 3 ) );
	} )(),
	address = ( ( ) => {
		const address = (_.find( args , ( arg ) => { return arg.search('--a=') !== -1 } ));
		if ( _.isUndefined( address ) ) return '0.0.0.0';
		else return address.substr( 3 );
	} )(),


	/* Common Paths Parsing */

	src	= process.cwd() + '/source',
	dst = process.cwd() + '/app',
	asm = process.cwd() + '/.assembly',
	pck = process.cwd() + '/.packaged';

log.starting( 'Teflon Application Compiler' );

function compilePackages ( packaging , destination , vulc ) {

	let externalFiles = [];

	return glob( `${packaging}/elements/**` , `${packaging}/elements/core/**` )
		.catch( error => { log.error( 'compilePackages => glob has failed' , error ); } )
		.then( excludedPaths => {
			externalFiles = _.filter( excludedPaths , modulePath => { return !fs.isDirectorySync( modulePath ); } );
			return vulc ?
				vulcanize( `${packaging}/index.html` , externalFiles )
					.then( buffer => { return fs.outputFileAsync( `${destination}/index.html` , buffer ); } )
					.catch( error => { log.error( 'compilePackages => vulcanizer has failed' , error ); } ) :
				rsvp.Promise.resolve();
		} )
		.then( () => {
			return rsvp.all( _.map( externalFiles , file => {
				return fs.copyAsync( file , file.replace( packaging , destination ) )
			} ) );
		} )
		.catch( error => { log.error( 'compilePackages has failed' , error ); } );

}

function deleteProcessFolders ( assembly , packaging ) {
	return rsvp.all([	fs.removeAsync(assembly),
						fs.removeAsync(packaging) ]);
}

function copyMedia( src , dest  ) {

	log.runningTask( 'copyMedia' , 'node' , src);

	return fs.removeAsync( `${dest}/media` )
		.then( () => { return fs.copyAsync( `${src}/media` , `${dest}/media` ) } )
		.catch( error => {
			log.error ( `copyMedia has failed to parse ${src}` , error );
			!watch && process.exit(1);
		} );

}

function applicationBuilder ( onlyCore ) {

	onlyCore = Boolean( onlyCore ) ? '/core' : '';

	const startTime = Date.now();

	log.starting( 'applicationBuilder' );

	return deleteProcessFolders( asm , pck )
		.catch( error => {
			log.error ( `applicationBuilder => deleteProcessFolders has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return compile.jade( `${src}/index.jade` , `${asm}/index.html` , compress ); } )
		.catch( error => {
			log.error ( `applicationBuilder => compile.jade has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return glob(`${src}/scripts/**`) } )
		.catch( error => {
			log.error ( `applicationBuilder => glob has failed` , error );
			!watch && process.exit(1);
		} )
		.then( scriptsPaths => {
			return rsvp.all( _.chain( scriptsPaths )
				.filter( scriptPath => { return !fs.isDirectorySync( scriptPath ); } )
				.map( scriptPath => { return compile.script( scriptPath , `${asm}/scripts/${path.basename(scriptPath)}` ); } )
				.value() );
		} )
		.catch( error => {
			log.error ( `applicationBuilder => compile.script has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return glob(`${src}/styles/**`) } )
		.catch( error => {
			log.error ( `applicationBuilder => glob has failed` , error );
			!watch && process.exit(1);
		} )
		.then( stylesPaths => {
			return rsvp.all( _.chain( stylesPaths )
				.filter( stylePath => { return !fs.isDirectorySync( stylePath ); } )
				.map( stylePath => { return compile.style( stylePath , `${asm}/styles/${path.basename(stylePath)}` ); } )
				.value() );
		} )
		.catch( error => {
			log.error ( `applicationBuilder => compile.style has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return assembleModule( `${src}/elements${onlyCore}` , asm , compress , !watch ); } )
		.catch( error => {
			log.error ( `applicationBuilder => assembleModule has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return packageModule( asm , pck , compress , !watch ); } )
		.catch( error => {
			log.error ( `applicationBuilder => packageModule has failed` , error );
			!watch && process.exit(1);
		} )
		.then ( () => {
			return rsvp.all([
				fs.copyAsync( `${asm}/scripts` , `${pck}/scripts` ),
				fs.copyAsync( `${asm}/styles` , `${pck}/styles` ),
				fs.copyAsync( `${asm}/index.html` , `${pck}/index.html` )
			]);
		} )
		.then( () => { return compilePackages( pck , dst , true ) } )
		.catch( error => {
			log.error ( `applicationBuilder => compilePackages has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => {
			return !debug ?
				deleteProcessFolders( asm , pck ) :
				rsvp.Promise.resolve();
		} )
		.then( () => { return copyMedia( src , dst ) } )
		.then( () => { log.success( `Finished Teflon Compilation : ${( Date.now() - startTime )}ms` ); } )
		.catch( error => {
			log.error ( `The build has failed` , error );
			!watch && process.exit(1);
		} );
}
function buildModule ( modulePath ) {

	log.starting( 'buildModule' , modulePath );

	const startTime = Date.now();

	return assembleModule( modulePath , asm , compress , !watch )
		.catch( error => {
			log.error ( `buildModule => assembleModule has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return packageModule( asm , pck , compress , !watch ); } )
		.catch( error => {
			log.error ( `buildModule => packageModule has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return compilePackages( pck , dst , false ) } )
		.catch( error => {
			log.error ( `buildModule => compilePackages has failed` , error );
			!watch && process.exit(1);
		} )
		.then( () => { return deleteProcessFolders( asm , pck ) } )
		.then( () => { log.success( `Finished Building Module : ${( Date.now() - startTime )}ms` ); } )
		.catch( error => {
			log.error ( `buildModule has failed` , error );
			!watch && process.exit(1);
		} )

}

applicationBuilder(false);

if ( serve ) {

	const
		app = express(),
		server = app.listen( port , address , ( ) => {

			log.startingServer(
				server.address().address,
				server.address().port,
				'express' );

			app.use( '/' , express.static( dst ) );

	} );

}

if ( watch ) {

	const findFirstOrderModule = function findFirstOrderModule ( filePath ) {

		if ( filePath.search( `${src}/elements` ) !== -1 ) {
			while ( path.dirname( path.dirname( filePath  ) ) !== `${src}/elements` ) {
				filePath = path.dirname( filePath );
			}
		} else {
			return false;
		}

		return {
			path : filePath,
			core : filePath.search( `${src}/elements/core` ) !== -1
		};

	}

	watcher( src , filename => {
		const fileInfo = findFirstOrderModule( filename );
		if ( fileInfo && !fileInfo.core ) {
			log.changing( filename , 'change' , 'buildModule' );
			buildModule( fileInfo.path );
		} else {
			log.changing( filename , 'change' , 'applicationBuilder' );
			applicationBuilder(false);
		}
	} );

}