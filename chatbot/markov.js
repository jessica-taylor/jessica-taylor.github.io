// JavaScript Document

var mapfw = {};
var mapbw = {};
var source;
var tokensource;
var order;
var i;
var j;
var from;

function generatemarkov()
{
source = '.';
source+= arguments[0];
if(source[source.length-1]!=='.')source+='.';

tokensource = tokenize(source);

for(order = 1; order < tokensource.length; order++)
{
	for(i=1;i<tokensource.length;i++)
	{
		from = [];
		if(i+order>tokensource.length)break;
		for(j=0;j<order;j++)
		{
			from.push(tokensource[i+j]);
		}	
		if(mapfw[from]===undefined){
		mapfw[from] = [];
		}
		mapfw[from].push(tokensource[i+order]);
		//console.log("mapfw["+from+"].push("+tokensource[i+order]+")");
	}
	for(i=tokensource.length-1;i>=0;i--)
	{
		from = [];
		if(i-order<0)break;
		for(j=0;j<order;j++)
		{
			from.push(tokensource[i-j]);
		}
		if(mapbw[from]===undefined){
		mapbw[from] = [];
		}
		mapbw[from].push(tokensource[i-order]);
		//console.log("mapbw["+from+"].push("+tokensource[i-order]+")");		
	}
}
}

function convertsubj(subj)
{
	if(subj === 'i')return 'you';
	if(subj === 'you')return 'i';
	if(subj === 'me')return 'you';
	if(subj === 'myself')return 'yourself';
	return subj;
}


	var texttoken;
	var output1;
	var output2;
	var mapidx;
	var prev;
	var cur;
	var tokensrc;

function generatenext(text)
{
	texttoken = tokenize(text);
	
	// Check if any of the word in the source is seen before
	var genpossible = false;
	for(i = 0; i < texttoken.length; i++)
	{
		mapidx = [];
		mapidx.push(texttoken[i]);
		if(mapfw[mapidx] !== undefined)genpossible = true;
	}
	// if no word is seen before, return an empty string
	if(!genpossible)return "";
	
	// random source word
	while(true)
	{
	var idx = Math.floor(Math.random()*texttoken.length);
	prev =  texttoken[idx];
	mapidx = [];
	mapidx.push(prev);
	if(mapfw[mapidx] !== undefined)break;
	}
	
	tokensrc = prev;
	
	output2 = '';
	output2 += convertsubj(tokensrc);
	output2 += ' ';
	//console.log(output2);
	cur = mapfw[mapidx][Math.floor(Math.random()*mapfw[mapidx].length)];
	
	while(cur !== '.' && cur !== undefined)
	{
		output2 += convertsubj(cur);
		output2 += ' ';
		//console.log(output2);
		mapidx = [];
		mapidx.push(prev);
		mapidx.push(cur);
		prev = cur;
		if(mapfw[mapidx] === undefined)break;
		cur = mapfw[mapidx][Math.floor(Math.random()*mapfw[mapidx].length)];
	}
	output2+='.';


	mapidx = [];
	mapidx.push(tokensrc);
	output1 = '';

	//console.log(output2);
	cur = mapbw[mapidx][Math.floor(Math.random()*mapbw[mapidx].length)];
	
	while(cur !== '.' && cur !== undefined)
	{
		output1 = convertsubj(cur) + ' ' + output1;
		//console.log(output1);
		mapidx = [];
		mapidx.push(prev);
		mapidx.push(cur);
		prev = cur;
		if(mapbw[mapidx] === undefined)break;
		cur = mapbw[mapidx][Math.floor(Math.random()*mapbw[mapidx].length)];
	}

	return " Also, " + output1 + output2;
	
}
