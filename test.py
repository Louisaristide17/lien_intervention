ingredients = ['flour', 'louis', 'eggs', 'milk']
out_of_stock = ['sugar', 'louis', 'butter']
for ingredient in ingredients:
    if ingredient in out_of_stock:
        print(f" {ingredient} n'est pas en stock")
        break
    else:
        print("tous les ingredients sont en stock")