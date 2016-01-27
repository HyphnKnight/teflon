const
	generators	= require( 'yeoman-generator' ),
	path		= require( 'path' ),
	jade		= require( 'jade' ),
	_			= require( 'underscore' ),
	prompter	= require( `${__dirname}/../bin/prompter.js` ),
	fs			= require( 'fs-extra-promise' ),
	log			= require( 'log' );

function createVar ( name , value ) {
	return `-var ${name} = ${value}\n`;
}

function createCollectionImports ( elements ) {
	return _.chain( elements )
		.map( element => { return element.split(' | '); } )
		.groupBy( element => { return element[0]; } )
		.map( ( elements , collection ) => {
			return createCollectionImport( collection , _.map( elements , element => { return element[1]; } ) );
		} )
		.value().join('\n');
}

function createCollectionImport ( collection , elements ) {
	return  `\t\t+htmlImports( \'${collection}\' , [ \'${elements.join('\' , \'')}\' ] )`;
}

function createFavicon ( url ) {
	return `\t\tlink(rel="icon" href='#{${url}}' type="image/x-icon")`
}

function createKeywords ( keywords ) {
	return `\t\tmeta(name='keywords' content='#{${keywords}}')`
}

function createFacebook ( type , image , url ) {

	return	`\t\tmeta(property='og:type' content='#{${type}}')\n\t\tmeta(property='og:description' content='#{description}')\n\t\tmeta(property='og:image' content='#{${image}}')\n\t\tmeta(property='og:url' content='#{${url}}')\n\t\tmeta(property='og:site_name' content='#{title}')`;

}

function buildPage ( src , title , description , author , favicon , facebook , keywords , elements ) {

	return	`${createVar( 'title' , title )}${createVar( 'description' , description )}${createVar( 'author' , author )}\n` +
			src +
			`\n${ !!favicon ? createFavicon(favicon) : '' }\n${ !!facebook ? createFacebook( facebook.type , facebook.image , facebook.url ) : '' }\n${ !!keywords ? createKeywords(keywords) : '' }\n` +
			`\n${ !!elements ? createCollectionImports(elements) : '' }` +
			'\n\tbody';

}

function getElementList ( source ) {

	return _.chain( fs.readdirSync( `${source}/elements` , 'utf8' ) )
		.filter( collection => { return collection.search('.DS_Store') === -1; } )
		.map( collection => {
			return _.chain( fs.readdirSync( `${source}/elements/${collection}` ) )
				.filter( element => { return element.search('.DS_Store') === -1; } )
				.map( element => {
					return `${collection} | ${element}`;
				})
				.value();
		} )
		.flatten()
		.value();

}

module.exports = generators.Base.extend({

	constructor : function ( ) {

		generators.Base.apply(this, arguments);

		this.argument('pageName', { type: String, required: true });

	},

	initializing : {

		initiated : function ( ) {

			log.runningTask( 'add-page', 'Teflon' );

		}

	},

	prompting : {

		templateType	: prompter( 'list',
									'templateType',
									'template language :',
									'jade',
									[ 'html' , 'jade' ] ),

		description		: prompter( 'input',
									'description',
									'page description :',
									'' ),

		author			: prompter( 'input',
									'author',
									'page author :',
									'' ),

		favicon			: prompter( 'input',
									'favicon',
									'favicon :',
									'' ),

		facebook_type	: prompter( 'input',
									'facebook_type',
									'open graph type :',
									'' ),

		facebook_image	: prompter( 'input',
									'facebook_image',
									'open graph image :',
									'' ),

		facebook_url	: prompter( 'input',
									'facebook_url',
									'open graph url :',
									'' ),

		elements		: prompter( 'checkbox',
									'elements',
									'template language :',
									['core | core-polymer','core | core-scripts','core | core-styles'],
									getElementList(`${process.cwd()}/source`) ),
	},

	writing : {

		indexFile : function () {

			const buffer = buildPage(	fs.readFileSync( `${__dirname}/index.jade` ),
										this.pageName,
										this.config.get('description') === '' ? null : this.config.get('description'),
										this.config.get('author') === '' ? null : this.config.get('author'),
										this.config.get('favicon') === '' ? null : this.config.get('favicon'),
										this.config.get('facebook_type') !== '' || this.config.get('facebook_image') !== '' || this.config.get('facebook_url') !== '' ?
											{	type : this.config.get('facebook_type'),
												image : this.config.get('facebook_image'),
												url : this.config.get('facebook_url') } : null,
										this.config.get('keywords'),
										this.config.get('elements') );

			if ( this.config.get( 'templateType' ) === 'html' ) {
				fs.writeFileSync( `${process.cwd()}/source/${this.pageName}.html` , jade(buffer) );
			} else {
				fs.writeFileSync( `${process.cwd()}/source/${this.pageName}.jade` , buffer );
			}

		}

	}

});