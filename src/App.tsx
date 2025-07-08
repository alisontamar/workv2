import { useState, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { ProductCard } from "./components/ProductCard";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { Employees } from "./components/Employees";
import { Suppliers } from "./components/Suppliers";
import { ExchangeRateComponent } from "./components/ExchangeRate";
import { ProductForm } from "./components/ProductForm";
import { Sales } from "./components/Sales";
import { TransferComponent } from "./components/Transfer";
import { Movements } from "./components/Movements";
import { Stores } from "./components/Stores";
import { PurchaseOrders } from "./components/PurchaseOrders";
import { Login } from "./components/Login";
import { supabase } from "./lib/supabase";
import { Product, Store, Employee } from "./types";

const initialProducts: Product[] = [];
const initialStores: Store[] = [];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [exchangeRate, setExchangeRate] = useState(6.96);
  const [productsInactivesLength, setProductsInactivesLength] = useState(0);
  useEffect(() => {
    const fetchData = async () => {
      // Cargar productos
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

      if (productsError)
        console.error("Error fetching products:", productsError);
      else {
        setProducts(productsData.filter((p) => p.active));
        setProductsInactivesLength(
          productsData.filter((p) => !p.active).length
        );
      }

      // Cargar tiendas
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("*");

      if (storesError) console.error("Error fetching stores:", storesError);
      else setStores(storesData || []);

      // Cargar empleados
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("*");

      if (employeesError)
        console.error("Error fetching employees:", employeesError);
      else setEmployees(employeesData || []);

      // Cargar último tipo de cambio
      const { data: ratesData, error: ratesError } = await supabase
        .from("exchange_rates")
        .select("rate")
        .order("created_at", { ascending: false })
        .limit(1);

      if (ratesError)
        console.error("Error fetching exchange rate:", ratesError);
      else if (ratesData.length > 0) setExchangeRate(ratesData[0].rate);
    };

    fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
    const checkAuth = async () => {
      // Verificar si hay un empleado guardado en localStorage
      const employeeData = localStorage.getItem("currentEmployee");
      if (employeeData) {
        const employee = JSON.parse(employeeData);
        setCurrentEmployee(employee);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (employee: any) => {
    setCurrentEmployee(employee);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const handleProductSubmit = async (data: Partial<Product>) => {
    // Solo permitir a administradores crear/editar productos
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    try {
      let operation;

      if (selectedProduct) {
        // Actualización
        operation = await supabase
          .from("products")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedProduct.id)
          .select();
      } else {
        // Inserción
        operation = await supabase
          .from("products")
          .insert([
            {
              ...data,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              active: true,
            },
          ])
          .select();
      }

      if (operation.error) {
        throw operation.error;
      }

      // Actualiza el estado local con el producto devuelto por Supabase
      if (operation.data) {
        const updatedProduct = operation.data[0];
        setProducts((prevProducts) =>
          selectedProduct
            ? prevProducts.map((p) =>
                p.id === updatedProduct.id ? updatedProduct : p
              )
            : [...prevProducts, updatedProduct]
        );
      }

      setShowProductForm(false);
      setSelectedProduct(undefined);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto");
    }
  };

  const handleStoreCreate = (data: Partial<Store>) => {
    // Solo permitir a administradores
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    const newStore = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Store;
    setStores([...stores, newStore]);
  };

  const handleStoreUpdate = (id: string, data: Partial<Store>) => {
    // Solo permitir a administradores
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    setStores(
      stores.map((store) =>
        store.id === id
          ? { ...store, ...data, updated_at: new Date().toISOString() }
          : store
      )
    );
  };

  const handleStoreDelete = (id: string) => {
    // Solo permitir a administradores
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    if (
      confirm(
        "¿Está seguro de eliminar esta tienda? Los productos asignados quedarán sin tienda."
      )
    ) {
      setStores(stores.filter((store) => store.id !== id));
      setProducts(
        products.map((product) =>
          product.store_id === id ? { ...product, store_id: "" } : product
        )
      );
    }
  };

  const handleProductAssign = (storeId: string, productId: string) => {
    // Solo permitir a administradores
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }
    if(!storeId) return;
    setProducts(
      products.map((product) =>
        product.id === productId ? { ...product, store_id: storeId } : product
      )
    );
  };

  const handleTransferSubmit = async (transferData: {
    products: { id: string; quantity: number }[];
    fromStoreId: string;
    toStoreId: string;
    employeeId: string;
  }) => {
    // Solo permitir a administradores crear transferencias
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    try {
      // Create the transfer record
      const transferId = crypto.randomUUID();
      const { error: transferError } = await supabase.from("transfers").insert([
        {
          id: transferId,
          from_store_id: transferData.fromStoreId,
          to_store_id: transferData.toStoreId,
          employee_id: transferData.employeeId,
          transfer_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

      if (transferError) throw transferError;

      // Create transfer items
      const transferItems = transferData.products.map((product) => ({
        id: crypto.randomUUID(),
        transfer_id: transferId,
        product_id: product.id,
        quantity: product.quantity,
        created_at: new Date().toISOString(),
      }));

      const { error: itemsError } = await supabase
        .from("transfer_items")
        .insert(transferItems);

      if (itemsError) throw itemsError;

      console.log("Transfer created successfully");
    } catch (error) {
      console.error("Error saving transfer:", error);
      alert("Error al guardar la transferencia");
    }
  };

  const handleEdit = (product: Product) => {
    // Solo permitir a administradores editar productos
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleToggleActive = async (id: string) => {
    // Solo permitir a administradores desactivar productos
    if (currentEmployee?.position !== "administrador") {
      alert("No tienes permisos para realizar esta acción");
      return;
    }

    try {
      // 1. Actualizar en Supabase (cambiar active a false)
      const { error } = await supabase
        .from("products")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;

      // 2. Actualizar el estado local (filtrar o marcar como inactive)
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === id ? { ...p, active: false } : p))
      );
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const productsByRole = (productsStore: any) => {
    if (currentEmployee?.position === "administrador") {
      return productsStore.filter((product) => product.active);
    }

    return productsStore.filter((product => product.store_id === currentEmployee?.store_id && product.active));
  };

  const filteredProducts = productsByRole(products)
  .filter((product) => {
    const term = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term) ||
      product.color.toLowerCase().includes(term)
    );
  });
  console.log(filteredProducts)
  const renderContent = () => {
    const productsActive = productsByRole(products).length;

    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            onSaleClick={() => setCurrentPage("sales")}
            onTransferClick={() => setCurrentPage("transfers")}
          />
        );
      case "sales":
        return <Sales exchangeRate={exchangeRate} />;
      case "transfers":
        return (
          <TransferComponent
            products={products}
            stores={stores}
            employees={employees}
            onSubmit={handleTransferSubmit}
          />
        );
      case "movements":
        return <Movements />;
      case "stores":
        return (
          <Stores
            stores={stores}
            products={products}
            onStoreCreate={handleStoreCreate}
            onStoreUpdate={handleStoreUpdate}
            onStoreDelete={handleStoreDelete}
            onProductAssign={handleProductAssign}
          />
        );
      case "purchase-orders":
        return <PurchaseOrders />;
      case "employees":
        return <Employees />;
      case "products":
        return (
          <main>
            {showProductForm ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {selectedProduct ? "Editar Producto" : "Nuevo Producto"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowProductForm(false);
                      setSelectedProduct(undefined);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
                <ProductForm
                  onSubmit={handleProductSubmit}
                  product={selectedProduct}
                  stores={stores}
                />
              </div>
            ) : (
              <>
                <header className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="search"
                    placeholder="Buscar productos..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </header>
                {/* Tarjetas de contadores solo para admin*/}
                {currentEmployee?.position === "administrador" ? (
                  <section className="flex gap-4 my-8">
                    <div className="bg-gray-700/50 p-6 w-1/2 rounded-xl border border-gray-600/50">
                      <h3 className="text-2xl font-semibold mb-4 text-blue-300">
                        Cantidad de Productos
                      </h3>
                      <p className="text-gray-300 font-bold text-2xl">
                        {productsActive} productos activos
                      </p>
                    </div>
                    <div className="bg-gray-700/50 p-6 w-1/2 rounded-xl border border-gray-600/50">
                      <h3 className="text-2xl font-semibold mb-4 text-blue-300">
                        Cantidad de Productos Inactivos
                      </h3>
                      <p className="text-gray-300 font-bold text-2xl">
                        {productsInactivesLength} productos inactivos
                      </p>
                    </div>
                  </section>
                ) : (
                  <section className="flex gap-4 my-8">
                    <div className="bg-gray-700/50 p-6 w-1/2 rounded-xl border border-gray-600/50">
                      <h3 className="text-2xl font-semibold mb-4 text-blue-300">
                        {/* Poner el nombre de la tienda del empleado*/}
                        Cantidad de Productos{" "}
                        {stores.find(
                          (store) => store.id === currentEmployee?.store_id
                        )?.name || "de la tienda"}
                      </h3>
                      <p className="text-gray-300 font-bold text-2xl">
                        {productsActive} productos
                      </p>
                    </div>
                  </section>
                )}

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={handleEdit}
                      onToggleActive={handleToggleActive}
                      exchangeRate={exchangeRate}
                    />
                  ))}
                </section>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">
                      No se encontraron productos
                    </p>
                  </div>
                )}
              </>
            )}
          </main>
        );
      case "suppliers":
        return <Suppliers />;
      case "exchange":
        return (
          <ExchangeRateComponent
            onRateChange={(rate) => setExchangeRate(rate)}
          />
        );
      default:
        return null;
    }
  };

  const handleRateChange = (rate: number) => {
    setExchangeRate(rate);
    // Forzar re-renderizado de los productos
    setProducts([...products]);
  };

  // Verificar permisos para mostrar botones de acción
  const canCreateProduct =
    currentEmployee?.position === "administrador" &&
    currentPage === "products" &&
    !showProductForm;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        currentEmployee={currentEmployee}
      />

      <div className="flex-1 ml-0 md:ml-64">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {currentPage === "products" && "Gestión de Productos"}
                {currentPage === "dashboard" && "Dashboard"}
                {currentPage === "employees" && "Gestión de Empleados"}
                {currentPage === "suppliers" && "Gestión de Proveedores"}
                {currentPage === "exchange" && "Tipo de Cambio"}
                {currentPage === "sales" && "Nueva Venta"}
                {currentPage === "transfers" && "Nueva Transferencia"}
                {currentPage === "movements" && "Movimientos"}
                {currentPage === "stores" && "Gestión de Tiendas"}
                {currentPage === "purchase-orders" && "Órdenes de Compra"}
              </h1>
              {canCreateProduct && (
                <button
                  onClick={() => setShowProductForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} />
                  Nuevo Producto
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
