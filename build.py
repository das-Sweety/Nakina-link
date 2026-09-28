import json,csv
P='/mnt/project/'
prods=[[r['product_id'],r['product_name'],float(r['length_in']),float(r['width_in']),float(r['height_in']),float(r['weight_lb'])] for r in csv.DictReader(open(P+'products_reference_1.csv'))]
data={'stage1':open(P+'contestant_stage1_orders_1.csv').read(),'stage2':open(P+'contestant_stage2_orders.csv').read(),'flights':open(P+'flight_capacity_stage2.csv').read(),'bonus':open('/mnt/user-data/uploads/bonus_challange.csv').read(),'products':prods}
h=open('shell.html').read().replace('/*__DATA__*/',json.dumps(data,separators=(',',':')).replace('</','<\\/')).replace('/*__APP__*/',open('app.js').read())
open('index.html','w').write(h);print(len(h))
