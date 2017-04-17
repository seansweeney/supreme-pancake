var http = require("http");
var https = require("https");
var colors = require("colors");
var dateFormat = require("dateformat");
var fs = require("fs");

var pollingInterval = 60000;

// Schedule tests
setInterval(homepageTest, pollingInterval);
setInterval(elineTest, pollingInterval);
setInterval(calendarTest, pollingInterval);
setInterval(CCFADBSearchForm, pollingInterval);
setInterval(CCFADBCouncilorSearch, pollingInterval);
setInterval(CCFADBCommitteeSearch, pollingInterval);
setInterval(CCFADBKeywordSearch, pollingInterval);

// Run each test once immediately
homepageTest();
elineTest();
calendarTest();
CCFADBSearchForm();
CCFADBCouncilorSearch();
CCFADBCommitteeSearch();
CCFADBKeywordSearch();

// Test functions
function homepageTest() {
	performTest("City Homepage", "http://www.cambridgema.gov/", 200, 22000, 30000);
}

function elineTest() {
	performTest("E-Line Homepage", "http://secure.cambridgema.gov/eline", 200, 0, 0);
}

function calendarTest() {
	performTest("City Calendar", "http://www.cambridgema.gov/citycalendar", 200, 0, 0);
}

function CCFADBSearchForm() {
	performTest("CCFADB Search Form", "http://www2.cambridgema.gov/cityclerk/search.cfm", 200, 0, 0);
}

function CCFADBCouncilorSearch() {
	performTest("CCFADB Search - Councilor", "http://www2.cambridgema.gov/cityClerk/SearchResults.cfm?searchType=councillor&newSearch=1&councillor_id=61&search1=Search", 200, 75000, 85000, "Councillor Carlone");
}

function CCFADBCommitteeSearch() {
	performTest("CCFADB Search - Committee", "http://www2.cambridgema.gov/cityClerk/SearchResults.cfm?searchType=committee&newSearch=1&committee_id=94%2C77%2C60%2C11%2C27%2C44&search1=Search", 200, 60000, 70000, "Human Services Committee");
}

function CCFADBKeywordSearch() {
	performTest("CCFADB Search - Keyword (Foundry)", "http://www2.cambridgema.gov/cityClerk/SearchResults.cfm?searchType=keyword&newSearch=1&keyword=foundry&search_mode=phrase&date_lo=&date_hi=&type=cm_agenda&search3=Search", 200, 25000, 35000, "Foundry");
}

/*
var options = {
	hostname: "www.cambridgema.gov",
	port: 80,
	path: "/",
	method: "GET"
};

var reqHomepage = http.get("http://www.cambridgema.gov/", (res) => {
	const statusCode = res.statusCode;
	const encoding = res.headers["Content-Type"];
	var responseBody = "";

	// Read the response body
	res.on("data", (data) => {
		responseBody += data;
	});

	res.on("end", () => {
		// Check the status code, find out how we made out
		if (statusCode === 200)
			console.log(`Everything's cool on the homepage\nCode: ${statusCode}\tResponse length: ${responseBody.length}`);
		else
			console.log(`Things aren't cool, got a status code ${statusCode} response!`);
	});
}).on("error", (e) => {
	console.log(`Got an error making request: ${e.message}`);
});
*/

// Makes an HTTP request and tests the response
function performTest(name, url, expStatus = 200, expLenLow = 0, expLenHigh = 0, expToken = "") {
	var proto = http;
	var start = Date.now();

	if (url.substr(0,8) == "https://")
		proto = https;

	//console.log(`Performing test "${name}"\nURL: ${url}\nExpect Status: ${expStatus}\nExpect response length ${expLenLow} to ${expLenHigh} bytes\nExpect token: ${expToken}`);
	var request = proto.get(url, (res) => {
		const statusCode = res.statusCode;
		const encoding = res.headers["Content-Type"];
		var responseBody = "";
		var responseTime = 0;

		res.setEncoding("UTF-8");

		// Read the full response body
		res.on("data", (data) => {
			responseBody += data;
		});

		// On the first data event, record the end time and calculate the response time
		res.once("data", (data) => {
			var end = Date.now();
			responseTime = end - start;
		});

		// At the end of the request...
		res.on("end", () => {
			// Check if we received a 301 response - if so, re-execute this test at the new URL
			if (statusCode === 301)
			{
				//console.log(`Got 301 response, location is ${res.headers['location']}`);
				performTest(name, res.headers['location'], expStatus, expLenLow, expLenHigh, expToken);
			}
			else
			{
				// Test booleans - true indicates the test will be performed
				var tStatus = (expStatus !== 0);
				var tLen = (expLenLow > 0 && expLenHigh > 0);
				var tToken = (expToken != "");

				// Test result booleans - results of the tests that are performed, default all results to true so a skipped test can still be examined
				var rStatus = true;
				var rLen = true;
				var rToken = true;

				// Contains a colored string for the result of the test overall
				var testResult = "";

				/*if (tStatus)
					console.log("Testing for status code");
				if (tLen)
					console.log("Testing for response length");
				if (tToken)
					console.log("Testing for token");*/

				// Test for status code
				if (tStatus && statusCode !== expStatus)
					rStatus = false;

				// Test for content length
				if (tLen && ((responseBody.length < expLenLow || responseBody.length > expLenHigh)))
					rLen = false;

				// Test for token
				if (tToken && !responseBody.search(expToken))
					rToken = false;

				if (rStatus && rLen && rToken)
				{
					testResultConsole = "PASS".green;
					testResultLog = "PASS";
				}
				else
				{
					testResultConsole = "FAIL".red;
					testResultLog = "FAIL";
				}

				// Output
				logResult(`${testResultConsole}\t${name}\t${responseTime}ms`, `${testResultLog}\t${name}\t${responseTime}ms`);

				if (!rStatus)
					logResult(`Failed on status - expected ${expStatus}, got ${statusCode}`);

				if (!rLen)
				{
					logResult(`Failed on length - expected between ${expLenLow} and ${expLenHigh}, but response was ${responseBody.length}`);
					/*
						var outFile = name.replace(" ", "-") + ".html";
						fs.writeFileSync(outFile, responseBody);
					*/
				}

				if (!rToken)
					logResult(`Failed on token search - could not find token ${expToken} in the response body.`);
			}
		});
	}).on("error", (e) => {
		logResult(`Got an error making request: ${e.message}`);
	});
}

function logResult(consoleData, fileData) {
	if (fileData === undefined)
		fileData = consoleData;

	// Log to console
	console.log(`[${dateFormat(new Date(), "HH:MM:ss")}]: ${consoleData}`);

	// Log to file
	fs.appendFileSync("./log.txt", `[${dateFormat(new Date(), "HH:MM:ss")}]: ${fileData}\n`);
}