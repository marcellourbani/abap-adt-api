import { decodeQueryResult, extractBindingUrls, parseQueryResponse, parseServiceBinding } from "../api/tablecontents"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"

test("parse table data", () => {
    const raw = `<?xml version="1.0" encoding="utf-8"?><dataPreview:tableData xmlns:dataPreview="http://www.sap.com/adt/dataPreview"><dataPreview:totalRows>74</dataPreview:totalRows><dataPreview:isHanaAnalyticalView>false</dataPreview:isHanaAnalyticalView><dataPreview:executedQueryString>SELECT TRAVEL_UUID,BOOKING_DATE FROM YMU_RAP_ABOOK WHERE BOOKING_ID = '0005'   INTO     TABLE @DATA(LT_RESULT)   UP TO 2  ROWS   .</dataPreview:executedQueryString><dataPreview:queryExecutionTime>19.1530000</dataPreview:queryExecutionTime><dataPreview:columns><dataPreview:metadata dataPreview:name="TRAVEL_UUID" dataPreview:type="X" dataPreview:description="TRAVEL_UUID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>908A18E09B6AAE4217000C02EA89A7D9</dataPreview:data><dataPreview:data>938A18E09B6AAE4217000C02EA89A7D9</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="BOOKING_DATE" dataPreview:type="D" dataPreview:description="BOOKING_DATE" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>20210524</dataPreview:data><dataPreview:data>20200714</dataPreview:data></dataPreview:dataSet></dataPreview:columns></dataPreview:tableData>`
    const data = parseQueryResponse(raw)
    expect(data).toBeDefined()
    expect(data.columns.length).toBe(2)
    expect(data.values.length).toBe(2)
    for (const v of data.values) for (const c of data.columns) expect(v[c.name]).toBeTruthy()
})

test("longer table data", () => {
    const raw = `<?xml version="1.0" encoding="utf-8"?><dataPreview:tableData xmlns:dataPreview="http://www.sap.com/adt/dataPreview"><dataPreview:totalRows>0</dataPreview:totalRows><dataPreview:name>YMU_RAP_ATRAV</dataPreview:name><dataPreview:isHanaAnalyticalView>false</dataPreview:isHanaAnalyticalView><dataPreview:queryExecutionTime>21.6270000</dataPreview:queryExecutionTime><dataPreview:columns><dataPreview:metadata dataPreview:name="CLIENT" dataPreview:type="C" dataPreview:description="CLIENT" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="3"/><dataPreview:dataSet><dataPreview:data>100</dataPreview:data><dataPreview:data>100</dataPreview:data><dataPreview:data>100</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="BOOKING_UUID" dataPreview:type="X" dataPreview:description="BOOKING_UUID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>608B18E09B6AAE4217000C02EA89A7D9</dataPreview:data><dataPreview:data>6E8B18E09B6AAE4217000C02EA89A7D9</dataPreview:data><dataPreview:data>7A8B18E09B6AAE4217000C02EA89A7D9</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="TRAVEL_UUID" dataPreview:type="X" dataPreview:description="UUID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="16" dataPreview:caseSensitive="false"/><dataPreview:dataSet><dataPreview:data>908A18E09B6AAE4217000C02EA89A7D9</dataPreview:data><dataPreview:data>938A18E09B6AAE4217000C02EA89A7D9</dataPreview:data><dataPreview:data>948A18E09B6AAE4217000C02EA89A7D9</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="BOOKING_ID" dataPreview:type="N" dataPreview:description="BOOKING_ID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>0005</dataPreview:data><dataPreview:data>0005</dataPreview:data><dataPreview:data>0005</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="BOOKING_DATE" dataPreview:type="D" dataPreview:description="BOOKING_DATE" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>20210524</dataPreview:data><dataPreview:data>20200714</dataPreview:data><dataPreview:data>20200714</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="CUSTOMER_ID" dataPreview:type="N" dataPreview:description="Customer ID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="6" dataPreview:caseSensitive="false"/><dataPreview:dataSet><dataPreview:data>000093</dataPreview:data><dataPreview:data>000399</dataPreview:data><dataPreview:data>000399</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="CARRIER_ID" dataPreview:type="C" dataPreview:description="CARRIER_ID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>UA</dataPreview:data><dataPreview:data>AA</dataPreview:data><dataPreview:data>AA</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="CONNECTION_ID" dataPreview:type="N" dataPreview:description="CONNECTION_ID" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>1537</dataPreview:data><dataPreview:data>0322</dataPreview:data><dataPreview:data>0322</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="FLIGHT_DATE" dataPreview:type="D" dataPreview:description="FLIGHT_DATE" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>20210528</dataPreview:data><dataPreview:data>20200803</dataPreview:data><dataPreview:data>20200803</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="FLIGHT_PRICE" dataPreview:type="P" dataPreview:description="FLIGHT_PRICE" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false"/><dataPreview:dataSet><dataPreview:data>438.00 </dataPreview:data><dataPreview:data>438.00 </dataPreview:data><dataPreview:data>438.00 </dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="CURRENCY_CODE" dataPreview:type="C" dataPreview:description="Currency Code" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="5"/><dataPreview:dataSet><dataPreview:data>USD</dataPreview:data><dataPreview:data>USD</dataPreview:data><dataPreview:data>USD</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="CREATED_BY" dataPreview:type="C" dataPreview:description="User Name" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="12" dataPreview:caseSensitive="false"/><dataPreview:dataSet><dataPreview:data>Detemple</dataPreview:data><dataPreview:data>Neubasler</dataPreview:data><dataPreview:data>Mechler</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="LAST_CHANGED_BY" dataPreview:type="C" dataPreview:description="User Name" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="12" dataPreview:caseSensitive="false"/><dataPreview:dataSet><dataPreview:data>Mustermann</dataPreview:data><dataPreview:data>Illner</dataPreview:data><dataPreview:data>Koslowski</dataPreview:data></dataPreview:dataSet></dataPreview:columns><dataPreview:columns><dataPreview:metadata dataPreview:name="LOCAL_LAST_CHANGED_AT" dataPreview:type="P" dataPreview:description="Time Stamp" dataPreview:keyAttribute="false" dataPreview:colType="" dataPreview:isKeyFigure="false" dataPreview:length="21" dataPreview:caseSensitive="false"/><dataPreview:dataSet><dataPreview:data>20200716033718.0000000 </dataPreview:data><dataPreview:data>20200726020943.0000000 </dataPreview:data><dataPreview:data>20200716065706.0000000 </dataPreview:data></dataPreview:dataSet></dataPreview:columns></dataPreview:tableData>`
    const data = decodeQueryResult(parseQueryResponse(raw))
    expect(data).toBeDefined()
    expect(data.columns.length).toBe(14)
    expect(data.values.length).toBe(3)
    for (const v of data.values)
        for (const c of data.columns)
            expect(v[c.name]).toBeTruthy()
    expect(data.values[0].CLIENT).toBe("100")
    expect(data.values[0].BOOKING_UUID).toBe("608B18E09B6AAE4217000C02EA89A7D9")
    expect(data.values[0].BOOKING_ID).toBe(5)
    expect(data.values[0].BOOKING_DATE).toStrictEqual(new Date("2021-05-24"))// "20210524"
    expect(data.values[0].FLIGHT_PRICE).toBe(438.00)
})
test("parse service binding", () => {
    const raw = `<?xml version="1.0" encoding="utf-8"?><srvb:serviceBinding srvb:releaseSupported="false" srvb:published="true" srvb:repair="false" srvb:bindingCreated="true" adtcore:responsible="CB0000000083" adtcore:masterLanguage="EN" adtcore:masterSystem="TRL" adtcore:name="YMU_RAP_UI_TRAVEL_O2" adtcore:type="SRVB/SVB" adtcore:changedAt="2020-11-10T07:27:29Z" adtcore:version="active" adtcore:createdAt="2020-11-02T00:00:00Z" adtcore:changedBy="CB0000000083" adtcore:createdBy="CB0000000083" adtcore:description="binding" adtcore:language="EN" xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings" xmlns:adtcore="http://www.sap.com/adt/core"><atom:link href="/sap/bc/adt/businessservices/odatav2/YMU_RAP_UI_TRAVEL_O2" rel="http://www.sap.com/categories/odatav2" type="application/vnd.sap.adt.businessservices.odatav2.v2+xml" title="ODATAV2" xmlns:atom="http://www.w3.org/2005/Atom"/><atom:link href="/sap/bc/adt/businessservices/testclass" rel="http://www.sap.com/categories/testclass" type="application/vnd.sap.adt.businessservices.testclass.v1+xml" title="TESTCLASS" xmlns:atom="http://www.w3.org/2005/Atom"/><adtcore:packageRef adtcore:uri="/sap/bc/adt/packages/ymu_rap_travel" adtcore:type="DEVC/K" adtcore:name="YMU_RAP_TRAVEL" adtcore:description="travel app"/><srvb:serviceDefinition/><srvb:services srvb:name="YMU_RAP_UI_TRAVEL_O2"><srvb:content srvb:version="0001" srvb:releaseState=""><srvb:serviceDefinition adtcore:uri="/sap/bc/adt/ddic/srvd/sources/ymu_rap_ui_travel" adtcore:type="SRVD/SRV" adtcore:name="YMU_RAP_UI_TRAVEL"/></srvb:content></srvb:services><srvb:binding srvb:type="ODATA" srvb:version="V2" srvb:category="0"><srvb:implementation adtcore:name="YMU_RAP_UI_TRAVEL_O2"/></srvb:binding></srvb:serviceBinding>`
    const bindings = parseServiceBinding(raw)
    expect(bindings.name).toBe("YMU_RAP_UI_TRAVEL_O2")
    expect(bindings.links[0].href).toBe("/sap/bc/adt/businessservices/odatav2/YMU_RAP_UI_TRAVEL_O2")
    expect(bindings.services[0].version).toBe("0001")
    expect(bindings.releaseSupported).toBe(false)
    expect(bindings.published).toBe(true)
    const urls = extractBindingUrls(bindings)
    expect(urls[0].url).toBe("/sap/bc/adt/businessservices/odatav2/YMU_RAP_UI_TRAVEL_O2?servicename=YMU_RAP_UI_TRAVEL_O2&serviceversion=0001&srvdname=YMU_RAP_UI_TRAVEL")
})

test("parse binding details", () => {
    const raw = `<?xml version="1.0" encoding="utf-8"?><odatav2:serviceList xmlns:odatav2="http://www.sap.com/categories/odatav2"><odatav2:services odatav2:repositoryId="" odatav2:serviceId="YMU_RAP_UI_TRAVEL_O2" odatav2:serviceVersion="0001" odatav2:serviceUrl="/sap/opu/odata/sap/YMU_RAP_UI_TRAVEL_O2" odatav2:annotationUrl="/sap/opu/odata/sap/IWFND/CATALOGSERVICE/Annotations(TechnicalName='YMU_RAP_UI_TRAVEL_O2_VAN',Version='0001')/$value/" odatav2:published="true" odatav2:created="true"><serviceInfo:serviceInformation serviceInfo:name="YMU_RAP_UI_TRAVEL_O2" serviceInfo:version="0001" serviceInfo:url="https://e478ca1c-d502-4b7f-a72b-78a4f5447844.abap-web.eu10.hana.ondemand.com:443/sap/bc/bsp/sap/feap_odatav2_i/index.html" xmlns:serviceInfo="http://www.sap.com/categories/serviceinformation"><serviceInfo:collection serviceInfo:name="Agency"><serviceInfo:navigation serviceInfo:name="to_Country" serviceInfo:target="Country"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Airport"><serviceInfo:navigation serviceInfo:name="to_Country" serviceInfo:target="Country"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Carrier"><serviceInfo:navigation serviceInfo:name="to_Currency" serviceInfo:target="Currency"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Connection"><serviceInfo:navigation serviceInfo:name="to_Airline" serviceInfo:target="Carrier"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Customer"><serviceInfo:navigation serviceInfo:name="to_Country" serviceInfo:target="Country"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Flight"><serviceInfo:navigation serviceInfo:name="to_Airline" serviceInfo:target="Carrier"/><serviceInfo:navigation serviceInfo:name="to_Connection" serviceInfo:target="Connection"/><serviceInfo:navigation serviceInfo:name="to_Currency" serviceInfo:target="Currency"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Country"/><serviceInfo:collection serviceInfo:name="Currency"/><serviceInfo:collection serviceInfo:name="Booking"><serviceInfo:navigation serviceInfo:name="to_Carrier" serviceInfo:target="Carrier"/><serviceInfo:navigation serviceInfo:name="to_Connection" serviceInfo:target="Connection"/><serviceInfo:navigation serviceInfo:name="to_Currency" serviceInfo:target="Currency"/><serviceInfo:navigation serviceInfo:name="to_Customer" serviceInfo:target="Customer"/><serviceInfo:navigation serviceInfo:name="to_Flight" serviceInfo:target="Flight"/><serviceInfo:navigation serviceInfo:name="to_Travel" serviceInfo:target="Travel"/></serviceInfo:collection><serviceInfo:collection serviceInfo:name="Travel"><serviceInfo:navigation serviceInfo:name="to_Agency" serviceInfo:target="Agency"/><serviceInfo:navigation serviceInfo:name="to_Booking" serviceInfo:target="Booking"/><serviceInfo:navigation serviceInfo:name="to_Currency" serviceInfo:target="Currency"/></serviceInfo:collection></serviceInfo:serviceInformation></odatav2:services><atom:link href="/sap/bc/adt/aps/iam/sush/0517d0390bf9772c906124b61cb1a0ht" rel="http://www.sap.com/iam/sush" title="SU22 Object Reference" n0:name="0517D0390BF9772C906124B61CB1A0HT" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:n0="SUSH"/></odatav2:serviceList>`
})