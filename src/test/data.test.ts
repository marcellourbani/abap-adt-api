import { parseQueryResponse } from "../api/tablecontents"

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
    const data = parseQueryResponse(raw)
    expect(data).toBeDefined()
    expect(data.columns.length).toBe(14)
    expect(data.values.length).toBe(3)
    for (const v of data.values)
        for (const c of data.columns)
            expect(v[c.name]).toBeTruthy()
})
// [
//  "C",
//  "X",
//  "D",
//  "N",
//  "P",
// ]
// TYPEKIND_DATE       'D'
// TYPEKIND_DECFLOAT   '/'
// TYPEKIND_DECFLOAT16 'a'
// TYPEKIND_DECFLOAT34 'e'
// TYPEKIND_FLOAT      'F'
// TYPEKIND_HEX        'X'
// TYPEKIND_INT        'I'
// TYPEKIND_INT1       'b'
// TYPEKIND_INT8       '8'
// TYPEKIND_INT2       's'
// TYPEKIND_NUM        'N'
// TYPEKIND_NUMERIC    '%'
// TYPEKIND_PACKED     'P'
// TYPEKIND_TIME       'T'
// TYPEKIND_W          'w'






// TYPEKIND_ANY        '~'
// TYPEKIND_CHAR       'C'
// TYPEKIND_CLASS      '*'
// TYPEKIND_CLIKE      '&'
// TYPEKIND_CSEQUENCE  '?'
// TYPEKIND_DATA       '#'
// TYPEKIND_DATE       'D'
// TYPEKIND_DECFLOAT   '/'
// TYPEKIND_DECFLOAT16 'a'
// TYPEKIND_DECFLOAT34 'e'
// TYPEKIND_DREF       'l'
// TYPEKIND_FLOAT      'F'
// TYPEKIND_HEX        'X'
// TYPEKIND_INT        'I'
// TYPEKIND_INT1       'b'
// TYPEKIND_INT8       '8'
// TYPEKIND_INT2       's'
// TYPEKIND_INTF       '+'
// TYPEKIND_IREF       'm'
// TYPEKIND_NUM        'N'
// TYPEKIND_NUMERIC    '%'
// TYPEKIND_OREF       'r'
// TYPEKIND_PACKED     'P'
// TYPEKIND_SIMPLE     '$'
// TYPEKIND_STRING     'g'
// TYPEKIND_STRUCT1    'u'
// TYPEKIND_STRUCT2    'v'
// TYPEKIND_TABLE      'h'
// TYPEKIND_TIME       'T'
// TYPEKIND_W          'w'
// TYPEKIND_XSEQUENCE  '!'
// TYPEKIND_XSTRING    'y'
// TYPEKIND_BREF       'j'
