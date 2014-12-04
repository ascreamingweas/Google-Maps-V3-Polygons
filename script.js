var polyMap, util;

function initialize() {
    var savedLatLng, mapPolygons = {}, map, infowindow, infowindow2, infoWindowTemplate, groupWindowTemplate, checkBoxBit = false;
    var polyDict = {"turb.json":"airTurb","ice.json":"airIce","ifr.json":"airIFR","mtn.json":"airMTOS","out.json":"airOut","con.json":"sigCon","testSIGMET.json":"sigmet"};
    var polyPath = "http://153.90.201.52:82/killiantest/data/Aviation/sigmets/";
    var infoWindowTemplate = '<div class="infowindow"><b><u>Type: {type}</u></b><br/><b>Valid Dates:</b> {valid}' +
        '<br/><b>Hazard:</b> {hazard}<br/><b>Severity:</b> {severity}<br/><b>Minimum Altitude:</b> {min_alt}' +
        '<br/><b>Maximum Altitude:</b> {max_alt}<br/><b>Movement Speed:</b> {mov_speed}' +
        '<br/><b>Movement Direction:</b> {mov_dir}<hr><b>Raw Text:</b> {raw}';
    var groupWindowTemplate = ['<table cellpadding="0" cellspacing="0" border="0"><tbody>' +
        '<tr><th>Valid Time (UTC)</th><th></th><th></th><th>Altitude (ft)</th><th></th></tr>' +
        '<tr><th>Start -- End</th><th>Hazard</th><th>Severity</th><th>Min</th><th>Max</th><th>Link</th></tr>',
        '<tr><td>{valid}</td><td>{hazard}</td><td>{severity}</td><td>{min_alt}</td><td>{max_alt}</td><td>{link}</td></tr>',
        '</tbody></table>'];
    
    polyMap = {};
    util = {};
    //date object functions to make formatting a date easier
    Date.prototype.getDayName = function () { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][this.getDay()]; };
    Date.prototype.getMonthName = function () { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][this.getMonth()]; };
    Date.prototype.getMinute = function () { return (String(this.getMinutes()).length > 1) ? String(this.getMinutes()) : '0' + String(this.getMinutes()); };
    Date.prototype.getHour = function () { if (this.getHours() === 0) { return "12"; } else { return String((this.getHours() > 12) ? this.getHours() - 12 : this.getHours()); } };
    Date.prototype.getAMPM = function () { return (this.getHours() >= 12) ? "PM" : "AM"; };
    Date.prototype.stdOffset = function () { return Math.max((new Date(this.getFullYear(), 0, 1)).getTimezoneOffset(), (new Date(this.getFullYear(), 6, 1)).getTimezoneOffset()); };
    Date.prototype.isDST = function () { return this.getTimezoneOffset() < this.stdOffset(); };
    Date.prototype.getTimezoneName = function () { if (this.isDST()) { return ['UTC', 0, 0, 'ADT', 'EDT', 'CDT', 'MDT', 'PDT', 'AKDT', 'HADT', 'SDT'][this.getTimezoneOffset() / 60]; } else { return ['UTC', 0, 0, 0, 'AST', 'EST', 'CST', 'MST', 'PST', 'AKST', 'HAST', 'SST'][this.getTimezoneOffset() / 60]; } };
    Date.prototype.getFormattedTime = function () { return this.getHour() + ":" + this.getMinute() + " " + this.getAMPM(); };
    //formats a date as HH:MM [AM|PM] TZ - ddd, mmm dd yyyy
    util.formatDate = function (timestring) {
        var dt = new Date(Date.UTC(timestring.slice(0, 4), timestring.slice(4, 6) - 1, timestring.slice(6, 8), timestring.slice(8, 10), timestring.slice(10, 12)));
        return dt.getFormattedTime() + ' ' + dt.getTimezoneName() + ' - ' + dt.getDayName() + ', ' + dt.getMonthName() + ' ' + String(dt.getDate()) + ' ' + String(dt.getFullYear());
    };
    util.getURL = function (url, callback) {
        var req;
        try {
            if (window.XMLHttpRequest) { req = new window.XMLHttpRequest(); } else { req = new ActiveXObject("Microsoft.XMLHTTP"); }
            req.open("GET", url + "?" + new Date().getTime(), true);
        } catch (exc) {
            throw ("XMLHTTP Error");
        }
        req.onreadystatechange = function () {
            if (req.readyState === 4 && req.status === 200) {
                callback(req.responseText);
            } else if (req.readyState === 4 && req.status === 404) {
                callback("File not found.");
            }
        };
        req.send("");
    };
    util.getJSON = function (url, callback) {
        util.getURL(url, function (JSONText) {
            var jsonobject;
            try {
                jsonobject = JSON.parse(JSONText);
            } catch (exc) {
                try {
                    jsonobject = eval('(' + JSONText + ')');
                } catch (exc2) {
                    jsonobject = [];
                }
            }
            callback(jsonobject);
            jsonobject = null;
        });
    };
    
    polyMap = {
        togglePolygon: function (callingDiv, id, layer) {
            if (callingDiv.className !== "menudisabled") {
                closeWindows();
                for (var i = 0; i < mapPolygons[polyDict[id]].length; i++) {
                    if (mapPolygons[polyDict[id]][i].getMap()) {
                        mapPolygons[polyDict[id]][i].setMap(null);
                    } else { mapPolygons[polyDict[id]][i].setMap(map); }
                }
            }
        },
        checkBox: function(callingDiv) {
            if (callingDiv.className !== "menudisabled") {
                if (!checkBoxBit) {
                    var checked = callingDiv.children[0].checked;
                    callingDiv.children[0].checked = (checked == true ? false : true);
                }
                checkBoxBit = false;
            }
        },
        setCheckBit: function() {
            checkBoxBit = true;
        }
    };

    map = new google.maps.Map(document.getElementById('map-canvas'), {center: new google.maps.LatLng(38.1803,-121.2714),zoom: 7,mapTypeId: google.maps.MapTypeId.TERRAIN});
    infowindow = new google.maps.InfoWindow({zIndex: 20});
    infowindow2 = new google.maps.InfoWindow({zIndex: 200});

    function loadActiveAirmets() {
        util.getJSON("http://153.90.201.52:82/killiantest/data/Aviation/sigmets/sigmets.json", function (list) {
            var activePolygons = list.active_reports;
            for (var i = 0; i < activePolygons.length; i++) {
                var div = document.getElementById(polyDict[activePolygons[i]]);
                div.children[0].removeAttribute("disabled");
                div.children[0].checked = true;
                div.className = "menuitem";
                loadPolygon(polyPath + activePolygons[i], polyDict[activePolygons[i]]); //addPolygon(url, id)
            }
            document.getElementById("airmetOptions").style.display = "block";
        });
    }
    
    function getInfoWindowContent(text) { // single polygon
        var attribute, temp = infoWindowTemplate;
        var matches = temp.match(/\{([^}]*)\}/g);
        for (var i = 0; i < matches.length; i++) {
            attribute = matches[i].match(/[a-zA-Z(_)?]+/)[0];
            if (text[attribute] === null || text[attribute] === "null") { // not present or null
                temp = temp.replace(temp.match(new RegExp("(<br/><b>[a-zA-Z ]+:</b> )?{" + attribute + "}"))[0], "");
            } else { // case for actual value from json
                temp = temp.replace(matches[i], text[attribute]);
            }
        }
        return temp;
    }
    
    function buildAggregateTable(text, num, id) {
        var temp = groupWindowTemplate[1];
        var matches = temp.match(/\{([^}]*)\}/g);
        for (var i = 0; i < matches.length; i++) {
            attribute = matches[i].match(/[a-zA-Z(_)?]+/)[0];
            if (attribute === "link") {
                temp = temp.replace(matches[i], '<a id="__polygon__' + String(id) + '_' + String(num) + '__">Full Report</a');
            } else if (text[attribute] === null || text[attribute] === "null") { // not present or null
                temp = temp.replace(temp.match(new RegExp("(<br/><b>[a-zA-Z ]+:</b> )?{" + attribute + "}"))[0], "");
            } else { // case for actual value from json
                temp = temp.replace(matches[i], text[attribute]);
            }
        }
        return temp;
    }
    
    function dateFormat(text) {
        var dates = /([0-9]{12}) UTC/.exec(text);
        while (dates !== null) {
            text = text.replace(/[0-9]{12} UTC/, util.formatDate(dates[1]).replace(/\s/g, "&nbsp;"));
            dates = /([0-9]{12}) UTC/.exec(text);
        }
        return text;
    }
    
    function assignOnClickFunctions(infowindowcontent) {
        var i, polyNum, anchorelements = infowindowcontent.getElementsByTagName("a"), getOnClickFunction;
        getOnClickFunction = function (id, polynumber) { return function () {
                infowindow2.setContent(dateFormat(getInfoWindowContent(mapPolygons[id][polynumber].text)));
                infowindow2.setPosition(savedLatLng);
                infowindow2.open(map);
            };
        };
        for (i = 0; i < anchorelements.length; i += 1) {
            var match = anchorelements[i].id.match(/([a-zA-Z]+_[0-9]+)/), polyNum, polyId;
            if (match) {
                polyNum = match[0].split("_")[1]; polyId = match[0].split("_")[0];
                anchorelements[i].onclick = getOnClickFunction(polyId, parseInt(polyNum));
            }
        }
    }
    
    function polygonClick(e) {
        var singleText = "", aggregateText = "", saveId, saveNum, singlePolygon = true, container; //assume there will be one popup
        savedLatLng = e.latLng;
        infowindow2.close();
        for (var polygon in mapPolygons) {
            for (var i = 0; i < mapPolygons[polygon].length; i++) {
                if (!mapPolygons[polygon][i].getMap()) {continue;}
                if (google.maps.geometry.poly.containsLocation(savedLatLng, mapPolygons[polygon][i])) {
                    if (singleText === "") {
                        saveId = polygon; saveNum = i;
                        singleText = getInfoWindowContent(mapPolygons[polygon][i].text);
                    } else {
                        if (singlePolygon) { //must add the first polygon that was found to aggregate pop-up
                            singlePolygon = false;
                            aggregateText = groupWindowTemplate[0];
                            aggregateText += buildAggregateTable(mapPolygons[saveId][saveNum].text, saveNum, saveId)
                        }
                        aggregateText += buildAggregateTable(mapPolygons[polygon][i].text, i, polygon);
                    }
                }
            }
        }
        container = document.createElement("div");
        if (singlePolygon) {
            container.className = "infowindow";
            container.innerHTML = dateFormat(singleText);
        } else {
            container.className = "aggregatewindow";
            container.innerHTML = dateFormat(aggregateText) + groupWindowTemplate[2];
            assignOnClickFunctions(container);
        }
        infowindow.setContent(container);
        infowindow.setPosition(savedLatLng);
        infowindow.open(map);
    }

    function loadPolygon(url, id) {
        closeWindows();
        util.getJSON(url, function (polygons) {
            var i, polygon, point, report;
            mapPolygons[id] = new Array();
            for (i = 0; i < polygons[0].length; i++) {
                for (report in polygons[0][i]) {
                    var paths = [], color = polygons[0][i][report].color, points = polygons[0][i][report].points;
                    for (point = 0; point < points.length; point++) {
                        paths.push(new google.maps.LatLng(points[point][0], points[point][1]));
                    }
                    polygon = new google.maps.Polygon({
                        name: report,
                        paths: paths,
                        strokeColor: '#'+color,    
                        strokeOpacity: 0.8,    
                        strokeWeight: 2,    
                        fillColor: '#'+color,    
                        fillOpacity: 0.35,
                        text: polygons[0][i][report].text_info
                    });
                    mapPolygons[id].push(polygon);
                    mapPolygons[id][i].setMap(map);
                    google.maps.event.addListener(mapPolygons[id][i], "click", polygonClick);
                }
            }
        });
    }
    
    function closeWindows() {
        infowindow.close();
        infowindow2.close();
    }
    
    loadActiveAirmets();
}

google.maps.event.addDomListener(window, 'load', initialize);













